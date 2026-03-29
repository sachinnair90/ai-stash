import readline from 'node:readline';
import { readLockfile } from '../lockfile/index.js';
import { getProjectRoot } from '../config/paths.js';
import { getRegistries } from '../registry/client.js';
import { checkUpdates, updateAssetFull, planUpdateFull } from '../engine/update.js';
import { resolveRegistry, getGitHubToken, parseTypeAndName } from './utils.js';
import { buildScriptDisclaimerText } from '../engine/script-risks.js';
import type { Lockfile } from '../lockfile/types.js';

function getRoot(): string {
  return getProjectRoot(process.cwd()) ?? process.cwd();
}

export async function handleUpdateCommand(args: string[]): Promise<void> {
  if (args.includes('--all')) {
    await updateAll(args);
  } else {
    await updateOne(args);
  }
}

async function updateOne(args: string[]): Promise<void> {
  const { type, name } = parseTypeAndName(args);

  const root = getRoot();
  const lockfile = readLockfile(root);

  if (!lockfile) {
    console.error(`Error: ${type} '${name}' is not installed`);
    process.exit(1);
  }

  // Find the lockfile key
  const matchingEntry = Object.entries(lockfile.installed).find(([key, entry]) => {
    const parts = key.split(':');
    return entry.type === type && parts.slice(2).join(':') === name;
  });

  if (!matchingEntry) {
    console.error(`Error: ${type} '${name}' is not installed`);
    process.exit(1);
  }

  const [lockfileKey] = matchingEntry;
  const registryName = lockfileKey.split(':')[0];

  // Find registry config
  const registryConfig = lockfile.registries.find((r) => r.name === registryName);
  if (!registryConfig) {
    console.error(`Error: registry '${registryName}' is not configured`);
    process.exit(1);
  }

  const token = getGitHubToken();
  const { assets } = await getRegistries([registryConfig], token);

  const updates = checkUpdates(lockfile, assets);
  const update = updates.find((u) => u.lockfileKey === lockfileKey);

  if (!update) {
    console.log(`${type} '${name}' already up to date (${matchingEntry[1].version})`);
    process.exit(0);
  }

  // Phase 1: Plan the update to detect script changes (no side effects)
  const planResult = await planUpdateFull(lockfileKey, root, lockfile, assets, token);

  let riskAccepted = false;
  let riskAcceptedAt: string | undefined;

  if (planResult?.scriptChanged && planResult.plan.manifest?.scripts) {
    const scripts = planResult.plan.manifest.scripts;
    const scriptNames: string[] = [];
    if (scripts.postInstall) scriptNames.push(`postInstall: ${scripts.postInstall}`);
    if (scripts.postUninstall) scriptNames.push(`postUninstall: ${scripts.postUninstall}`);
    const disclaimerText = buildScriptDisclaimerText(
      name,
      scriptNames,
      planResult.plan.scriptRisksContent,
      !!planResult.plan.manifest?.scriptRisks,
      !!scripts.postInstall,
      !!scripts.postUninstall,
      true,
    );
    process.stdout.write('\n' + disclaimerText + '\n\n');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const accepted = await new Promise<boolean>((resolve) => {
      rl.question('Accept risks and continue? [y/N]: ', (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'y');
      });
    });
    if (!accepted) {
      console.error('Update aborted.');
      process.exit(1);
    }
    riskAccepted = true;
    riskAcceptedAt = new Date().toISOString();
  }

  // Phase 2: Execute the update (files written only after acceptance)
  if (riskAccepted) {
    await updateAssetFull(lockfileKey, root, lockfile, assets, token, { riskAccepted, riskAcceptedAt });
  } else {
    await updateAssetFull(lockfileKey, root, lockfile, assets, token);
  }

  console.log(`Updated ${type} '${name}' (${update.installedVersion} → ${update.latestVersion})`);
}

async function updateAll(args: string[]): Promise<void> {
  const root = getRoot();
  const lockfile = readLockfile(root);

  if (!lockfile || Object.keys(lockfile.installed).length === 0) {
    console.log('no assets installed');
    process.exit(0);
  }

  const token = getGitHubToken();

  // Resolve which registry to fetch — use all configured registries
  const { assets } = await getRegistries(lockfile.registries, token);

  const updates = checkUpdates(lockfile, assets);
  const updateKeys = new Set(updates.map((u) => u.lockfileKey));

  if (updates.length === 0) {
    console.log('all assets are up to date');
    process.exit(0);
  }

  let updatedCount = 0;
  let scriptChangedAsset: string | null = null;

  for (const [lockfileKey, installed] of Object.entries(lockfile.installed)) {
    const parts = lockfileKey.split(':');
    const assetName = parts.slice(2).join(':') || lockfileKey;

    if (!updateKeys.has(lockfileKey)) {
      console.log(`  ${assetName}: already up to date (${installed.version})`);
      continue;
    }

    const update = updates.find((u) => u.lockfileKey === lockfileKey)!;

    // Phase 1: Plan the update to detect script changes (no side effects)
    const planResult = await planUpdateFull(lockfileKey, root, lockfile, assets, token);
    if (planResult?.scriptChanged) {
      scriptChangedAsset = assetName;
      break;
    }

    try {
      await updateAssetFull(lockfileKey, root, lockfile, assets, token);
      console.log(`  ${assetName}: updated (${update.installedVersion} → ${update.latestVersion})`);
      updatedCount++;
    } catch (err) {
      console.error(`  ${assetName}: failed — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (scriptChangedAsset) {
    const matchingEntry = Object.entries(lockfile.installed).find(([key]) => {
      const parts = key.split(':');
      return parts.slice(2).join(':') === scriptChangedAsset;
    });
    const assetType = matchingEntry?.[1].type ?? 'plugin';
    console.error(
      `\n  ${scriptChangedAsset}: script changed — re-run individually to review:\n` +
      `    ai-stash update ${assetType} ${scriptChangedAsset}`,
    );
    process.exit(1);
  }

  console.log(`\n${updatedCount}/${updates.length} assets updated`);
}
