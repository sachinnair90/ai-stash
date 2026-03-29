import readline from 'node:readline';
import { readLockfile } from '../lockfile/index.js';
import { getProjectRoot } from '../config/paths.js';
import { getRegistries } from '../registry/client.js';
import { planInstall, executeInstall, resolveForInstall } from '../engine/install.js';
import { buildScriptDisclaimerText } from '../engine/script-risks.js';
import { resolveRegistry, getGitHubToken, parseTypeAndName } from './utils.js';
import type { Lockfile } from '../lockfile/types.js';
import type { ConflictResolution } from '../engine/types.js';

function getRoot(): string {
  return getProjectRoot(process.cwd()) ?? process.cwd();
}

// Re-exported for backward compatibility with callers that import from this module.
export { buildScriptDisclaimerText } from '../engine/script-risks.js';

/**
 * Prompt the user interactively to accept script risks.
 * Returns true if accepted, false if declined.
 */
async function promptAcceptRisks(): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Accept risks and install? [y/N]: ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

export async function handleAddCommand(args: string[]): Promise<void> {
  const { type, name } = parseTypeAndName(args);
  const acceptScriptRisks = args.includes('--accept-script-risks');

  const root = getRoot();
  const existingLockfile = readLockfile(root);
  const lockfile: Lockfile = existingLockfile ?? {
    version: 2,
    registries: [],
    installed: {},
  };

  const registry = await resolveRegistry(args, lockfile);
  const token = getGitHubToken();

  const { assets } = await getRegistries([registry], token);
  const asset = assets.find((a) => a.type === type && a.name === name);

  if (!asset) {
    console.error(`Error: ${type} '${name}' not found in registry '${registry.name}'`);
    process.exit(1);
  }

  // Idempotency check — look for type+name in lockfile entries
  const existingEntry = Object.entries(lockfile.installed).find(([key, entry]) => {
    const parts = key.split(':');
    return entry.type === type && parts.slice(2).join(':') === name;
  });

  if (existingEntry) {
    const [, installedAsset] = existingEntry;
    if (installedAsset.version === asset.version) {
      console.log(`already installed (${installedAsset.version}), nothing to do`);
    } else {
      console.log(`already installed (${installedAsset.version}), use 'update' to upgrade`);
    }
    process.exit(0);
  }

  // Parse optional flags
  const scopeIdx = args.indexOf('--scope');
  const scope = (scopeIdx >= 0 ? args[scopeIdx + 1] : 'project') as 'project' | 'global';

  const targetIdx = args.indexOf('--target');
  const targets = targetIdx >= 0 ? args[targetIdx + 1].split(',') : asset.targets;

  const { resolvedAsset, lockfileKey } = resolveForInstall(asset, registry.name, registry.url, lockfile);

  const plan = await planInstall(resolvedAsset, targets, scope, root, lockfile, registry.url, token);

  // Risk disclaimer gate for scripted assets (tasks 5.1-5.6)
  let riskAccepted = false;
  let riskAcceptedAt: string | undefined;

  if (plan.manifest?.scripts) {
    const scripts = plan.manifest.scripts;
    const scriptNames: string[] = [];
    if (scripts.postInstall) scriptNames.push(`postInstall: ${scripts.postInstall}`);
    if (scripts.postUninstall) scriptNames.push(`postUninstall: ${scripts.postUninstall}`);

    const disclaimerText = buildScriptDisclaimerText(
      resolvedAsset.name,
      scriptNames,
      plan.scriptRisksContent,
      !!plan.manifest?.scriptRisks,
      !!scripts.postInstall,
      !!scripts.postUninstall,
    );

    process.stdout.write('\n' + disclaimerText + '\n\n');

    if (acceptScriptRisks) {
      // --accept-script-risks: print but skip interactive prompt
      riskAccepted = true;
      riskAcceptedAt = new Date().toISOString();
    } else {
      const accepted = await promptAcceptRisks();
      if (!accepted) {
        console.error('Installation aborted.');
        process.exit(1);
      }
      riskAccepted = true;
      riskAcceptedAt = new Date().toISOString();
    }
  }

  // Build resolutions (managed = overwrite, unmanaged = overwrite by default)
  const resolutions: Record<string, ConflictResolution> = {};
  for (const conflict of plan.conflicts) {
    resolutions[conflict.filePath] = 'overwrite';
  }

  const result = await executeInstall(
    plan,
    resolutions,
    root,
    lockfile,
    lockfileKey,
    registry.url,
    { riskAccepted, riskAcceptedAt },
  );

  console.log(`Installed ${type} '${result.asset.name}' (v${result.asset.version}) [${scope}]`);
  if (result.scriptNotice) {
    process.stderr.write(result.scriptNotice);
  }
}

