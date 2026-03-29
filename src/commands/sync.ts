import { readLockfile, getUnsyncedAssets } from '../lockfile/index.js';
import { getProjectRoot } from '../config/paths.js';
import { getRegistries } from '../registry/client.js';
import { syncFromLockfile } from '../engine/install.js';
import { getGitHubToken } from './utils.js';

function getRoot(): string {
  return getProjectRoot(process.cwd()) ?? process.cwd();
}

export async function handleSyncCommand(_args: string[]): Promise<void> {
  const root = getRoot();
  const lockfile = readLockfile(root);

  if (!lockfile) {
    console.log('no lockfile found, nothing to sync');
    process.exit(0);
  }

  const unsynced = getUnsyncedAssets(lockfile, root);

  if (unsynced.length === 0) {
    console.log('all assets are in sync');
    process.exit(0);
  }

  const token = getGitHubToken();
  const { assets: registryAssets } = await getRegistries(lockfile.registries, token);

  await syncFromLockfile(
    lockfile,
    registryAssets,
    root,
    (assetName, status) => {
      switch (status) {
        case 'installing':
          process.stdout.write(`  syncing ${assetName}...`);
          break;
        case 'done':
          console.log(` installed`);
          break;
        case 'skipped':
          console.log(`  skipped ${assetName} (not found in registry)`);
          break;
        case 'failed':
          console.log(` failed`);
          break;
        case 'orphaned':
          process.stderr.write(`  Warning: ${assetName} is orphaned (registry not configured), skipping\n`);
          break;
      }
    },
    token,
  );
}
