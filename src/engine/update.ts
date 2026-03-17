import type { RegistryAsset } from '../registry/types.js';
import type { Lockfile } from '../lockfile/types.js';
import type { Config } from '../config/types.js';
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
  installedVersion: string;
  latestVersion: string;
}

/**
 * Compare installed assets against registry to find updates.
 */
export function checkUpdates(
  lockfile: Lockfile | null,
  registry: RegistryAsset[],
): UpdateCheck[] {
  if (!lockfile) return [];

  const updates: UpdateCheck[] = [];
  for (const [name, installed] of Object.entries(lockfile.installed)) {
    const registryAsset = registry.find((a) => a.name === name);
    if (registryAsset && registryAsset.version !== installed.version) {
      updates.push({
        name,
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
  name: string,
  projectRoot: string,
  config: Config,
  lockfile: Lockfile,
  registry: RegistryAsset[],
): Promise<InstallResult> {
  const registryAsset = registry.find((a) => a.name === name);
  if (!registryAsset) {
    throw new Error(`Asset "${name}" not found in registry`);
  }

  const installed = lockfile.installed[name];
  if (!installed) {
    throw new Error(`Asset "${name}" is not installed`);
  }

  // Re-install with overwrite (managed files)
  return installAssetFull(
    registryAsset,
    installed.targets,
    installed.scope as 'project' | 'global',
    projectRoot,
    config,
    lockfile,
  );
}

/**
 * Update all outdated assets.
 */
export async function updateAllFull(
  projectRoot: string,
  config: Config,
  lockfile: Lockfile,
  registry: RegistryAsset[],
  onProgress?: (name: string, result: InstallResult) => void,
): Promise<InstallResult[]> {
  const outdated = checkUpdates(lockfile, registry);
  const results: InstallResult[] = [];

  for (const update of outdated) {
    const result = await updateAssetFull(
      update.name,
      projectRoot,
      config,
      lockfile,
      registry,
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
  name: string,
  projectRoot: string,
  lockfile: Lockfile,
): Promise<void> {
  const installed = lockfile.installed[name];
  if (!installed) {
    throw new Error(`Asset "${name}" is not installed`);
  }

  // Call removeAsset on each target adapter
  for (const target of installed.targets) {
    const adapter = getAdapter(target);
    if (adapter) {
      await adapter.removeAsset(installed, projectRoot);
    }
  }

  // Remove from lockfile
  delete lockfile.installed[name];
  writeLockfile(projectRoot, lockfile);
}

// --- TUI-compatible wrappers ---

/**
 * TUI-compatible updateAsset.
 * Matches the signature expected by UpdateView.tsx.
 */
export async function updateAsset(
  asset: RegistryAsset,
  lockfile: Lockfile,
  projectRoot: string,
  registryBaseUrl: string,
  githubToken?: string,
): Promise<UpdateResult> {
  const installed = lockfile.installed[asset.name];
  const fromVersion = installed?.version ?? '0.0.0';

  try {
    const config: Config = { registry: { name: '', url: registryBaseUrl }, cacheTTL: 3600, defaultTarget: 'claude-code', githubToken };
    await updateAssetFull(asset.name, projectRoot, config, lockfile, [asset]);
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
  assets: RegistryAsset[],
  lockfile: Lockfile,
  projectRoot: string,
  registryBaseUrl: string,
  githubToken?: string,
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  for (const asset of assets) {
    const result = await updateAsset(asset, lockfile, projectRoot, registryBaseUrl, githubToken);
    results.push(result);
  }
  return results;
}

/**
 * TUI-compatible removeAsset.
 * Matches the signature expected by RemoveView.tsx.
 */
export async function removeAsset(
  assetName: string,
  lockfile: Lockfile,
  projectRoot: string,
): Promise<RemoveResult> {
  const installed = lockfile.installed[assetName];
  const files = installed?.files ?? [];

  try {
    await removeAssetFull(assetName, projectRoot, lockfile);
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
