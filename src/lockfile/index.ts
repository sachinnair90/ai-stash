import type { Lockfile } from './types.js';

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

export { readLockfile } from './reader.js';
export { writeLockfile } from './writer.js';
export type { Lockfile, InstalledAsset } from './types.js';
