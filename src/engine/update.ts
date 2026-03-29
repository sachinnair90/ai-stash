import fs from 'node:fs';
import path from 'node:path';
import type { RegistryAsset, AssetManifest } from '../registry/types.js';
import type { Lockfile } from '../lockfile/types.js';
import { getAdapter } from '../adapters/registry.js';
import { writeLockfile } from '../lockfile/writer.js';
import { installAssetFull, buildScriptNotice, planInstall, executeInstall, resolveForInstall } from './install.js';
import { fetchManifest } from '../registry/fetcher.js';
import type { InstallResult, InstallPlan } from './types.js';

// TUI-compatible types
export interface UpdateResult {
  asset: string;
  fromVersion: string;
  toVersion: string;
  success: boolean;
  scriptChanged?: boolean;
  scriptRisksContent?: string;
  scriptsForDisclaimer?: string[];
}

export interface RemoveResult {
  asset: string;
  filesRemoved: string[];
  success: boolean;
  scriptNotice?: string;
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
 * Plan an update for a single asset without executing it.
 * Detects whether scripts have changed. Has no side effects.
 * Returns null if the asset or registry entry cannot be found.
 */
export async function planUpdateFull(
  lockfileKey: string,
  projectRoot: string,
  lockfile: Lockfile,
  registry: RegistryAsset[],
  githubToken?: string,
): Promise<{ plan: InstallPlan; scriptChanged: boolean } | null> {
  const parts = lockfileKey.split(':');
  if (parts.length < 3) return null;
  const registryName = parts[0];
  const assetName = parts.slice(2).join(':');

  const registryAsset = registry.find(
    (a) => a.name === assetName && a.registryName === registryName,
  ) ?? registry.find((a) => a.name === assetName);

  if (!registryAsset) return null;

  const installed = lockfile.installed[lockfileKey];
  if (!installed) return null;

  const { resolvedAsset: innerResolvedAsset } = resolveForInstall(
    registryAsset,
    registryName,
    installed.registryUrl,
    lockfile,
  );

  const plan = await planInstall(
    innerResolvedAsset,
    installed.targets,
    installed.scope as 'project' | 'global',
    projectRoot,
    lockfile,
    installed.registryUrl,
    githubToken,
  );

  // Detect script changes (same logic as updateAssetFull, no side effects)
  let scriptChanged = false;
  if (plan.scriptHashesForPlan) {
    const storedHashes = installed.scriptHashes ?? {};
    for (const [key, hash] of Object.entries(plan.scriptHashesForPlan)) {
      const stored = storedHashes[key as keyof typeof storedHashes];
      if (stored !== hash) { scriptChanged = true; break; }
    }
    if (!scriptChanged) {
      const incomingKeys = new Set(Object.keys(plan.scriptHashesForPlan));
      const storedKeys = new Set(Object.keys(storedHashes));
      for (const k of incomingKeys) {
        if (!storedKeys.has(k)) { scriptChanged = true; break; }
      }
      if (!scriptChanged) {
        for (const k of storedKeys) {
          if (!incomingKeys.has(k)) { scriptChanged = true; break; }
        }
      }
    }
  } else if (installed.scriptHashes && Object.keys(installed.scriptHashes).length > 0) {
    scriptChanged = true;
  }

  plan.scriptChanged = scriptChanged;
  return { plan, scriptChanged };
}

/**
 * Update a single asset to the latest registry version.
 * For folder-based assets: fetches new manifest, preserves configuredFiles,
 * and sets reconfigurationNeeded flag unless configStable is declared.
 */
export async function updateAssetFull(
  lockfileKey: string,
  projectRoot: string,
  lockfile: Lockfile,
  registry: RegistryAsset[],
  githubToken?: string,
  options?: { riskAccepted?: boolean; riskAcceptedAt?: string },
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

  // For folder-based assets, fetch manifest to check configStable (task 7.1)
  let newManifest: AssetManifest | undefined;
  if (registryAsset.folder) {
    try {
      newManifest = await fetchManifest(installed.registryUrl, registryAsset.folder, githubToken);
    } catch {
      // If manifest fetch fails, proceed without it
    }
  }

  // Detect script changes by hashing incoming scripts against stored hashes (tasks 4.1-4.2)
  let scriptChanged = false;

  // Run planInstall to get the incoming hashes before writing anything
  const { resolvedAsset: innerResolvedAsset, lockfileKey: innerLockfileKey } = resolveForInstall(
    registryAsset,
    registryName,
    installed.registryUrl,
    lockfile,
  );

  const incomingPlan = await planInstall(
    innerResolvedAsset,
    installed.targets,
    installed.scope as 'project' | 'global',
    projectRoot,
    lockfile,
    installed.registryUrl,
    githubToken,
  );

  // Compare incoming script hashes vs stored hashes (task 4.1-4.2)
  if (incomingPlan.scriptHashesForPlan) {
    const storedHashes = installed.scriptHashes ?? {};
    for (const [key, hash] of Object.entries(incomingPlan.scriptHashesForPlan)) {
      const stored = storedHashes[key as keyof typeof storedHashes];
      if (stored !== hash) {
        scriptChanged = true;
        break;
      }
    }
    // Also scriptChanged if a script was added (present in new but not old)
    if (!scriptChanged) {
      const incomingKeys = new Set(Object.keys(incomingPlan.scriptHashesForPlan));
      const storedKeys = new Set(Object.keys(storedHashes));
      // New script added
      for (const k of incomingKeys) {
        if (!storedKeys.has(k)) { scriptChanged = true; break; }
      }
      // Script removed
      if (!scriptChanged) {
        for (const k of storedKeys) {
          if (!incomingKeys.has(k)) { scriptChanged = true; break; }
        }
      }
    }
  } else if (installed.scriptHashes && Object.keys(installed.scriptHashes).length > 0) {
    // Scripts removed in new version
    scriptChanged = true;
  }

  // Attach scriptChanged flag to the plan for callers
  incomingPlan.scriptChanged = scriptChanged;

  // Reset risk acceptance when scripts changed (task 4.4) — do before install
  if (scriptChanged) {
    installed.riskAccepted = undefined;
    installed.riskAcceptedAt = undefined;
    lockfile.installed[lockfileKey] = installed;
  }

  // Build resolutions (managed = overwrite)
  const resolutions: Record<string, import('./types.js').ConflictResolution> = {};
  for (const c of incomingPlan.conflicts) {
    resolutions[c.filePath] = 'overwrite';
  }

  const result = await executeInstall(
    incomingPlan,
    resolutions,
    projectRoot,
    lockfile,
    innerLockfileKey,
    installed.registryUrl,
    { skipConfiguredFiles: !!newManifest, riskAccepted: options?.riskAccepted, riskAcceptedAt: options?.riskAcceptedAt },
  );

  // (task 4.3) Delete .setup-complete after writes when scripts changed
  if (scriptChanged && incomingPlan.manifest?.scripts?.postInstall) {
    if (result.installedFiles.length > 0) {
      const assetDir = path.dirname(path.join(projectRoot, result.installedFiles[0]));
      const markerPath = path.join(assetDir, '.setup-complete');
      if (fs.existsSync(markerPath)) {
        fs.unlinkSync(markerPath);
      }
    }
  }

  // Set reconfigurationNeeded flag for folder-based assets with userConfig (task 7.3)
  if (newManifest?.userConfig && Object.keys(newManifest.userConfig).length > 0) {
    if (!newManifest.configStable) {
      result.lockfileEntry.reconfigurationNeeded = true;
      lockfile.installed[innerLockfileKey] = result.lockfileEntry;
      writeLockfile(projectRoot, lockfile);
    }
  }

  result.scriptChanged = scriptChanged;
  result.plan = incomingPlan;
  return result;
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
 * Returns a script notice if the asset has a postUninstall script.
 */
export async function removeAssetFull(
  lockfileKey: string,
  projectRoot: string,
  lockfile: Lockfile,
): Promise<{ scriptNotice?: string }> {
  const installed = lockfile.installed[lockfileKey];
  if (!installed) {
    throw new Error(`Asset "${lockfileKey}" is not installed`);
  }

  // Read manifest.json from installed folder before deletion to check for postUninstall (task 6.4)
  let scriptNotice: string | undefined;
  if (installed.hasManifest && installed.files.length > 0) {
    const firstFile = installed.files[0];
    const assetDir = path.dirname(path.join(projectRoot, firstFile));
    const manifestPath = path.join(assetDir, 'manifest.json');
    try {
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as AssetManifest;
        if (manifest.scripts?.postUninstall) {
          const scriptPath = path.join(assetDir, manifest.scripts.postUninstall);
          scriptNotice = buildScriptNotice(scriptPath, 'uninstall');
        }
      }
    } catch {
      // Ignore manifest read errors during removal
    }
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

  return { scriptNotice };
}

// --- TUI-compatible wrappers ---

/**
 * TUI-compatible: plan an update without executing.
 * Returns plan info for showing a disclaimer before executing.
 */
export async function planUpdateResult(
  asset: RegistryAsset,
  lockfileKey: string,
  lockfile: Lockfile,
  projectRoot: string,
  githubToken?: string,
): Promise<{ plan: InstallPlan; scriptChanged: boolean; scriptsForDisclaimer: string[] } | null> {
  const planResult = await planUpdateFull(lockfileKey, projectRoot, lockfile, [asset], githubToken);
  if (!planResult) return null;
  const scripts = planResult.plan.manifest?.scripts;
  const scriptsForDisclaimer: string[] = [];
  if (scripts?.postInstall) scriptsForDisclaimer.push(`postInstall: ${scripts.postInstall}`);
  if (scripts?.postUninstall) scriptsForDisclaimer.push(`postUninstall: ${scripts.postUninstall}`);
  return { ...planResult, scriptsForDisclaimer };
}

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
  riskOptions?: { riskAccepted: boolean; riskAcceptedAt: string },
): Promise<UpdateResult> {
  const installed = lockfile.installed[lockfileKey];
  const fromVersion = installed?.version ?? '0.0.0';

  try {
    const fullResult = await updateAssetFull(lockfileKey, projectRoot, lockfile, [asset], githubToken, riskOptions);
    const scripts = fullResult.plan?.manifest?.scripts;
    const scriptsForDisclaimer: string[] = [];
    if (scripts?.postInstall) scriptsForDisclaimer.push(`postInstall: ${scripts.postInstall}`);
    if (scripts?.postUninstall) scriptsForDisclaimer.push(`postUninstall: ${scripts.postUninstall}`);
    return {
      asset: asset.name,
      fromVersion,
      toVersion: asset.version,
      success: true,
      scriptChanged: fullResult.scriptChanged,
      scriptRisksContent: fullResult.plan?.scriptRisksContent,
      scriptsForDisclaimer: scriptsForDisclaimer.length > 0 ? scriptsForDisclaimer : undefined,
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
    const { scriptNotice } = await removeAssetFull(lockfileKey, projectRoot, lockfile);
    return {
      asset: assetName,
      filesRemoved: files,
      success: true,
      scriptNotice,
    };
  } catch {
    return {
      asset: assetName,
      filesRemoved: [],
      success: false,
    };
  }
}
