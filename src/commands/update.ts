import { readLockfile } from '../lockfile/index.js';
import { getProjectRoot } from '../config/paths.js';
import { getRegistries } from '../registry/client.js';
import { checkUpdates, updateAssetFull } from '../engine/update.js';
import { resolveRegistry, getGitHubToken, parseTypeAndName } from './utils.js';
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

  await updateAssetFull(lockfileKey, root, lockfile, assets, token);
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
  for (const [lockfileKey, installed] of Object.entries(lockfile.installed)) {
    const parts = lockfileKey.split(':');
    const assetName = parts.slice(2).join(':') || lockfileKey;

    if (!updateKeys.has(lockfileKey)) {
      console.log(`  ${assetName}: already up to date (${installed.version})`);
      continue;
    }

    const update = updates.find((u) => u.lockfileKey === lockfileKey)!;
    try {
      await updateAssetFull(lockfileKey, root, lockfile, assets, token);
      console.log(`  ${assetName}: updated (${update.installedVersion} → ${update.latestVersion})`);
      updatedCount++;
    } catch (err) {
      console.error(`  ${assetName}: failed — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n${updatedCount}/${updates.length} assets updated`);
}
