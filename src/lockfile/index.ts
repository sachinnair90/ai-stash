import fs from 'node:fs';
import path from 'node:path';
import type { Lockfile, InstalledAsset } from './types.js';

export function isInstalled(lockfile: Lockfile | null, name: string): boolean {
  if (!lockfile) return false;
  return name in lockfile.installed;
}

export function getInstalledVersion(lockfile: Lockfile | null, name: string): string | null {
  if (!lockfile) return null;
  const asset = lockfile.installed[name];
  return asset?.version ?? null;
}

export function isUpdateAvailable(
  lockfile: Lockfile | null,
  name: string,
  registryVersion: string,
): boolean {
  const installedVersion = getInstalledVersion(lockfile, name);
  if (!installedVersion) return false;
  return installedVersion !== registryVersion;
}

export function getUnsyncedAssets(
  lockfile: Lockfile | null,
  projectRoot: string,
): Array<{ name: string; asset: InstalledAsset }> {
  if (!lockfile) return [];
  return Object.entries(lockfile.installed)
    .filter(([, asset]) => {
      const firstFile = asset.files[0];
      if (!firstFile) return false;
      const resolved = path.isAbsolute(firstFile)
        ? firstFile
        : path.join(projectRoot, firstFile);
      return !fs.existsSync(resolved);
    })
    .map(([name, asset]) => ({ name, asset }));
}

export { readLockfile } from './reader.js';
export { writeLockfile } from './writer.js';
export type { Lockfile, InstalledAsset } from './types.js';
