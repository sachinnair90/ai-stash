import type { RegistryAsset } from '../registry/types.js';
import type { Lockfile } from '../lockfile/types.js';
import { getAdapter } from '../adapters/registry.js';
import { writeLockfile } from '../lockfile/writer.js';
import { installAssetFull } from './install.js';
import type { InstallResult } from './types.js';

// TUI-compatible types
export interface UpdateResult {
  asset: string;
  fromVersion: string;
  toVersion: string;
  success: boolean;
}

export interface RemoveResult {
  asset: string;
  filesRemoved: string[];
  success: boolean;
}

export interface UpdateCheck {
  name: string;
  lockfileKey: string;
  installedVersion: string;
  latestVersion: string;
}

/**
 * Compare installed assets against registry to find updates.
 * Skips orphaned assets (registry name not in registries[]).
 */
export function checkUpdates(
  lockfile: Lockfile | null,
  registry: RegistryAsset[],
): UpdateCheck[] {
  if (!lockfile) return [];

  const configuredRegistryNames = new Set(lockfile.registries.map((r) => r.name));
  const updates: UpdateCheck[] = [];

  for (const [lockfileKey, installed] of Object.entries(lockfile.installed)) {
    const parts = lockfileKey.split(':');
    if (parts.length < 3) continue;
    const registryName = parts[0];

    // Skip orphaned assets
    if (!configuredRegistryNames.has(registryName)) continue;

    const assetName = parts.slice(2).join(':');

    // Match by name and registry
    const registryAsset = registry.find(
      (a) => a.name === assetName && a.registryName === registryName,
    ) ?? registry.find((a) => a.name === assetName);

    if (registryAsset && registryAsset.version !== installed.version) {
      updates.push({
        name: assetName,
        lockfileKey,
        installedVersion: installed.version,
        latestVersion: registryAsset.version,
      });
    }
  }
  return updates;
}

/**
 * Update a single asset to the latest registry version.
 */
export async function updateAssetFull(
  lockfileKey: string,
  projectRoot: string,
  lockfile: Lockfile,
  registry: RegistryAsset[],
  githubToken?: string,
): Promise<InstallResult> {
  const parts = lockfileKey.split(':');
  if (parts.length < 3) throw new Error(`Invalid lockfile key: "${lockfileKey}"`);
  const registryName = parts[0];
  const assetName = parts.slice(2).join(':');

  const registryAsset = registry.find(
    (a) => a.name === assetName && a.registryName === registryName,
  ) ?? registry.find((a) => a.name === assetName);

  if (!registryAsset) {
    throw new Error(`Asset "${assetName}" not found in registry`);
  }

  const installed = lockfile.installed[lockfileKey];
  if (!installed) {
    throw new Error(`Asset "${lockfileKey}" is not installed`);
  }

  return installAssetFull(
    registryAsset,
    installed.targets,
    installed.scope as 'project' | 'global',
    projectRoot,
    installed.registryUrl,
    lockfile,
    registryName,
    githubToken,
  );
}

/**
 * Update all outdated assets.
 */
export async function updateAllFull(
  projectRoot: string,
  lockfile: Lockfile,
  registry: RegistryAsset[],
  githubToken?: string,
  onProgress?: (name: string, result: InstallResult) => void,
): Promise<InstallResult[]> {
  const outdated = checkUpdates(lockfile, registry);
  const results: InstallResult[] = [];

  for (const update of outdated) {
    const result = await updateAssetFull(
      update.lockfileKey,
      projectRoot,
      lockfile,
      registry,
      githubToken,
    );
    results.push(result);
    onProgress?.(update.name, result);
  }

  return results;
}

/**
 * Remove an installed asset: delete files via adapters, update lockfile.
 */
export async function removeAssetFull(
  lockfileKey: string,
  projectRoot: string,
  lockfile: Lockfile,
): Promise<void> {
  const installed = lockfile.installed[lockfileKey];
  if (!installed) {
    throw new Error(`Asset "${lockfileKey}" is not installed`);
  }

  // Call removeAsset on each target adapter
  for (const target of installed.targets) {
    const adapter = getAdapter(target);
    if (adapter) {
      await adapter.removeAsset(installed, projectRoot);
    }
  }

  // Remove from lockfile
  delete lockfile.installed[lockfileKey];
  writeLockfile(projectRoot, lockfile);
}

// --- TUI-compatible wrappers ---

/**
 * TUI-compatible updateAsset.
 * Matches the signature expected by UpdateView.tsx.
 */
export async function updateAsset(
  asset: RegistryAsset,
  lockfileKey: string,
  lockfile: Lockfile,
  projectRoot: string,
  githubToken?: string,
): Promise<UpdateResult> {
  const installed = lockfile.installed[lockfileKey];
  const fromVersion = installed?.version ?? '0.0.0';

  try {
    await updateAssetFull(lockfileKey, projectRoot, lockfile, [asset], githubToken);
    return {
      asset: asset.name,
      fromVersion,
      toVersion: asset.version,
      success: true,
    };
  } catch {
    return {
      asset: asset.name,
      fromVersion,
      toVersion: asset.version,
      success: false,
    };
  }
}

/**
 * TUI-compatible updateAll.
 * Matches the signature expected by UpdateView.tsx.
 */
export async function updateAll(
  updates: UpdateCheck[],
  assets: RegistryAsset[],
  lockfile: Lockfile,
  projectRoot: string,
  githubToken?: string,
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  for (const update of updates) {
    const asset = assets.find((a) => a.name === update.name);
    if (!asset) continue;
    const result = await updateAsset(asset, update.lockfileKey, lockfile, projectRoot, githubToken);
    results.push(result);
  }
  return results;
}

/**
 * TUI-compatible removeAsset.
 * Matches the signature expected by RemoveView.tsx.
 */
export async function removeAsset(
  lockfileKey: string,
  lockfile: Lockfile,
  projectRoot: string,
): Promise<RemoveResult> {
  const installed = lockfile.installed[lockfileKey];
  const files = installed?.files ?? [];
  // Extract display name from key
  const parts = lockfileKey.split(':');
  const assetName = parts.slice(2).join(':') || lockfileKey;

  try {
    await removeAssetFull(lockfileKey, projectRoot, lockfile);
    return {
      asset: assetName,
      filesRemoved: files,
      success: true,
    };
  } catch {
    return {
      asset: assetName,
      filesRemoved: [],
      success: false,
    };
  }
}
