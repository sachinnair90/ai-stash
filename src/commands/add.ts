import { readLockfile } from '../lockfile/index.js';
import { getProjectRoot } from '../config/paths.js';
import { getRegistries } from '../registry/client.js';
import { installAssetFull } from '../engine/install.js';
import { resolveRegistry, getGitHubToken, parseTypeAndName } from './utils.js';
import type { Lockfile } from '../lockfile/types.js';

function getRoot(): string {
  return getProjectRoot(process.cwd()) ?? process.cwd();
}

export async function handleAddCommand(args: string[]): Promise<void> {
  const { type, name } = parseTypeAndName(args);

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

  const result = await installAssetFull(
    asset,
    targets,
    scope,
    root,
    registry.url,
    lockfile,
    registry.name,
    token,
  );

  console.log(`Installed ${type} '${result.asset.name}' (v${result.asset.version}) [${scope}]`);
  if (result.scriptNotice) {
    process.stderr.write(result.scriptNotice);
  }
}
