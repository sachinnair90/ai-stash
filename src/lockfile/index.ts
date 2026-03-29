import fs from 'node:fs';
import path from 'node:path';
import type { Lockfile, InstalledAsset } from './types.js';

/**
 * Check if an asset is installed by lockfile key (registry:type:name) or bare name.
 */
export function isInstalled(lockfile: Lockfile | null, key: string): boolean {
  if (!lockfile) return false;
  if (key in lockfile.installed) return true;
  // Also support bare name lookup (matches last segment of any key)
  return Object.keys(lockfile.installed).some((k) => {
    const parts = k.split(':');
    return parts[parts.length - 1] === key || k === key;
  });
}

/**
 * Get installed version by lockfile key or bare asset name.
 */
export function getInstalledVersion(lockfile: Lockfile | null, key: string): string | null {
  if (!lockfile) return null;
  if (key in lockfile.installed) return lockfile.installed[key]?.version ?? null;
  // Bare name fallback
  const entry = Object.entries(lockfile.installed).find(([k]) => {
    const parts = k.split(':');
    return parts[parts.length - 1] === key;
  });
  return entry?.[1]?.version ?? null;
}

export function isUpdateAvailable(
  lockfile: Lockfile | null,
  key: string,
  registryVersion: string,
): boolean {
  const installedVersion = getInstalledVersion(lockfile, key);
  if (!installedVersion) return false;
  return installedVersion !== registryVersion;
}

/**
 * Get unsynced assets, excluding orphaned ones (registry not in registries[]).
 */
export function getUnsyncedAssets(
  lockfile: Lockfile | null,
  projectRoot: string,
): Array<{ name: string; asset: InstalledAsset }> {
  if (!lockfile) return [];

  const configuredRegistryNames = new Set(lockfile.registries.map((r) => r.name));

  return Object.entries(lockfile.installed)
    .filter(([key, asset]) => {
      // Exclude orphaned assets
      const parts = key.split(':');
      if (parts.length >= 3) {
        const registryName = parts[0];
        if (!configuredRegistryNames.has(registryName)) return false;
      }
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
export type { Lockfile, InstalledAsset, RegistryConfig } from './types.js';
