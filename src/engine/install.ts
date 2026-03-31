import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { RegistryAsset, AssetManifest } from '../registry/types.js';
import { getUnsyncedAssets } from '../lockfile/index.js';
import type { Lockfile, InstalledAsset, RegistryConfig } from '../lockfile/types.js';
import type { AssetType } from '../adapters/types.js';
import { getAdapter } from '../adapters/index.js';
import { fetchAssetFile, fetchManifest, fetchScriptRisks } from '../registry/fetcher.js';
import { writeLockfile } from '../lockfile/writer.js';
import { collectUserConfig, substituteUserConfig } from './user-config.js';
import type {
  ConflictResolution,
  FileConflict,
  InstallPlan,
  InstallResult,
} from './types.js';

// TUI-compatible types (re-exported for backward compatibility)
export interface InstallOptions {
  scope: 'project' | 'global';
  targets: string[];
  projectRoot: string;
  registryBaseUrl: string;
  registryName: string;
  githubToken?: string;
}

export interface InstallFileStatus {
  file: string;
  status: 'pending' | 'installing' | 'done' | 'conflict';
}

export interface InstallFileResult {
  asset: string;
  files: InstallFileStatus[];
  success: boolean;
  suffixApplied?: { originalName: string; suffixedName: string; conflictingRegistry: string };
  scriptNotice?: string;
}

/**
 * Compute sha256 hex hash of script content for change detection.
 */
export function hashScriptContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Detect cross-registry conflict and resolve the asset name/key.
 * Returns the (possibly suffixed) asset to install and the lockfile key.
 */
export function resolveForInstall(
  asset: RegistryAsset,
  registryName: string,
  registryUrl: string,
  lockfile: Lockfile | null,
): {
  resolvedAsset: RegistryAsset;
  lockfileKey: string;
  suffixApplied: boolean;
  conflictingRegistry: string | null;
} {
  const lockfileKey = `${registryName}:${asset.type}:${asset.name}`;

  if (!lockfile) {
    return { resolvedAsset: asset, lockfileKey, suffixApplied: false, conflictingRegistry: null };
  }

  // Check if same type+name exists from a DIFFERENT registry URL
  for (const [key, installed] of Object.entries(lockfile.installed)) {
    const parts = key.split(':');
    if (parts.length < 3) continue;
    const [existingRegistry, existingType, ...nameParts] = parts;
    const existingName = nameParts.join(':');
    if (
      existingType === asset.type &&
      existingName === asset.name &&
      existingRegistry !== registryName &&
      installed.registryUrl !== registryUrl
    ) {
      // Conflict: same type+name from different registry
      const suffixedName = `${asset.name}-${registryName}`;
      const resolvedAsset: RegistryAsset = { ...asset, name: suffixedName };
      return {
        resolvedAsset,
        lockfileKey,
        suffixApplied: true,
        conflictingRegistry: existingRegistry,
      };
    }
  }

  return { resolvedAsset: asset, lockfileKey, suffixApplied: false, conflictingRegistry: null };
}

/**
 * Plan an installation: fetch files, transform them, and detect conflicts.
 */
export async function planInstall(
  asset: RegistryAsset,
  targets: string[],
  scope: 'project' | 'global',
  projectRoot: string,
  lockfile: Lockfile | null,
  registryBaseUrl: string,
  githubToken?: string,
): Promise<InstallPlan> {
  // For folder-based assets, fetch manifest first
  let manifest: AssetManifest | undefined;
  let filesToFetch: string[];

  if (asset.folder) {
    manifest = await fetchManifest(registryBaseUrl, asset.folder, githubToken);
    filesToFetch = manifest.files;
    // Populate asset.files from manifest so adapters can reference it
    asset = { ...asset, files: filesToFetch };
  } else if (asset.file) {
    filesToFetch = [asset.file];
    asset = { ...asset, files: filesToFetch };
  } else if (asset.files && asset.files.length > 0) {
    // Legacy registry entries that only provide `files` — use them directly
    filesToFetch = asset.files;
  } else {
    throw new Error(`Asset "${asset.name}" has neither a 'file' nor a 'folder' field`);
  }

  // For folder-based assets, manifest.files and scriptRisks paths are relative to the folder,
  // not the registry root. Compute a folder-scoped base URL so relative paths resolve correctly.
  const fileBaseUrl = asset.folder
    ? new URL(`${asset.folder}/`, registryBaseUrl).href
    : registryBaseUrl;

  // Fetch SCRIPT_RISKS.md content if declared in manifest (path relative to folder)
  let scriptRisksContent: string | undefined;
  if (manifest?.scriptRisks) {
    const content = await fetchScriptRisks(fileBaseUrl, manifest.scriptRisks, githubToken);
    scriptRisksContent = content ?? undefined;
  }

  // Fetch all asset files from registry
  // Normalise paths: if a path already includes the folder prefix (registry-root-relative),
  // strip it so it resolves correctly against the folder-scoped fileBaseUrl.
  const rawFiles: Record<string, string> = {};
  for (const filePath of filesToFetch) {
    const normalizedPath = (asset.folder && filePath.startsWith(`${asset.folder}/`))
      ? filePath.slice(asset.folder.length + 1)
      : filePath;
    rawFiles[filePath] = await fetchAssetFile(fileBaseUrl, normalizedPath, githubToken);
  }

  // Collect userConfig if manifest declares it (task 5.1)
  let nonSensitiveValues: Record<string, string> = {};
  if (manifest?.userConfig && Object.keys(manifest.userConfig).length > 0) {
    const collected = await collectUserConfig(asset.name, manifest.userConfig);
    nonSensitiveValues = collected.nonSensitive;
  }

  // Transform files through each target adapter
  let transformedFiles: Record<string, string> = {};
  for (const target of targets) {
    const adapter = getAdapter(target);
    if (!adapter) continue;
    const adapterFiles = adapter.transformFiles(asset, rawFiles);
    const installPaths = adapter.getInstallPaths(asset, scope, projectRoot);

    // Map transformed content to install paths
    const sourceFiles = Object.keys(adapterFiles);
    for (let i = 0; i < installPaths.length && i < sourceFiles.length; i++) {
      transformedFiles[installPaths[i]] = adapterFiles[sourceFiles[i]];
    }
  }

  // Apply userConfig substitution after adapter transformation (task 5.2)
  if (Object.keys(nonSensitiveValues).length > 0) {
    for (const filePath of Object.keys(transformedFiles)) {
      transformedFiles[filePath] = substituteUserConfig(transformedFiles[filePath], nonSensitiveValues);
    }
  }

  // Detect conflicts — check against lockfile key for managed detection
  const conflicts: FileConflict[] = [];
  // Find entry by matching asset name in lockfile keys (last segment)
  const installedEntry = lockfile
    ? Object.entries(lockfile.installed).find(([key]) => {
        const parts = key.split(':');
        return parts[parts.length - 1] === asset.name;
      })?.[1]
    : undefined;

  for (const filePath of Object.keys(transformedFiles)) {
    const relativePath = path.relative(projectRoot, filePath);
    if (fs.existsSync(filePath)) {
      const isManaged = installedEntry?.files.includes(relativePath) ?? false;
      conflicts.push({ filePath: relativePath, isManaged });
    }
  }

  // Compute script hashes from already-fetched rawFiles (no extra network requests)
  const scriptHashesForPlan: Record<string, string> = {};
  if (manifest?.scripts) {
    for (const [scriptKey, scriptFile] of Object.entries(manifest.scripts) as [string, string | undefined][]) {
      if (!scriptFile) continue;
      // rawFiles is keyed by relative path as declared in manifest.files
      // Scripts may be in a subfolder: find by basename or full path
      const content = rawFiles[scriptFile]
        ?? rawFiles[Object.keys(rawFiles).find((k) => k.endsWith(scriptFile) || k === scriptFile) ?? ''];
      if (content !== undefined) {
        scriptHashesForPlan[scriptKey] = hashScriptContent(content);
      }
    }
  }

  return {
    asset,
    targets,
    scope,
    files: transformedFiles,
    conflicts,
    manifest,
    scriptRisksContent,
    scriptHashesForPlan: Object.keys(scriptHashesForPlan).length > 0 ? scriptHashesForPlan : undefined,
  };
}

/**
 * Execute an install plan, writing files to disk and updating the lockfile.
 */
export async function executeInstall(
  plan: InstallPlan,
  resolutions: Record<string, ConflictResolution>,
  projectRoot: string,
  lockfile: Lockfile,
  lockfileKey?: string,
  registryUrl?: string,
  options?: { skipConfiguredFiles?: boolean; riskAccepted?: boolean; riskAcceptedAt?: string },
): Promise<InstallResult> {
  const installedFiles: string[] = [];
  const skippedFiles: string[] = [];

  // Build set of configuredFiles to handle specially
  const configuredFilesSet = new Set<string>();
  if (plan.manifest?.configuredFiles) {
    for (const cf of plan.manifest.configuredFiles) {
      configuredFilesSet.add(cf);
    }
  }
  // Auto-include .setup-complete when postInstall is declared
  if (plan.manifest?.scripts?.postInstall) {
    configuredFilesSet.add('.setup-complete');
  }

  for (const [absolutePath, content] of Object.entries(plan.files)) {
    const relativePath = path.relative(projectRoot, absolutePath);

    // Skip configuredFiles during update to preserve user config (task 7.2)
    if (options?.skipConfiguredFiles && configuredFilesSet.has(path.basename(relativePath))) {
      skippedFiles.push(relativePath);
      continue;
    }

    const conflict = plan.conflicts.find((c) => c.filePath === relativePath);
    const resolution = conflict ? resolutions[relativePath] : undefined;

    if (resolution === 'skip') {
      skippedFiles.push(relativePath);
      continue;
    }

    if (resolution === 'merge' && fs.existsSync(absolutePath)) {
      // Find the appropriate adapter to merge
      for (const target of plan.targets) {
        const adapter = getAdapter(target);
        if (adapter) {
          const existing = fs.readFileSync(absolutePath, 'utf-8');
          const merged = adapter.mergeIntoExisting(
            plan.asset.name,
            existing,
            content,
            plan.asset.type as AssetType,
          );
          fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
          fs.writeFileSync(absolutePath, merged, 'utf-8');
          installedFiles.push(relativePath);
          break;
        }
      }
      continue;
    }

    // Default: overwrite or new file
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf-8');
    installedFiles.push(relativePath);
  }

  // Append configuredFiles entries to .gitignore (task 5.3)
  if (configuredFilesSet.size > 0) {
    appendToGitignore(projectRoot, configuredFilesSet);
  }

  // Exclude configuredFiles from lockfile files[] (task 5.4)
  const lockfileFiles = installedFiles.filter(
    (f) => !configuredFilesSet.has(path.basename(f)),
  );

  // Update lockfile
  const lockfileEntry: InstalledAsset = {
    type: plan.asset.type,
    version: plan.asset.version,
    installedAt: new Date().toISOString(),
    targets: plan.targets,
    scope: plan.scope,
    files: lockfileFiles,
    registryUrl: registryUrl ?? '',
  };

  // Set hasManifest for folder-based assets (task 5.5)
  if (plan.manifest) {
    lockfileEntry.hasManifest = true;
  }

  // Write risk acceptance state when provided
  if (options?.riskAccepted) {
    lockfileEntry.riskAccepted = true;
    lockfileEntry.riskAcceptedAt = options.riskAcceptedAt ?? new Date().toISOString();
  }

  // Write script hashes from the plan
  if (plan.scriptHashesForPlan && Object.keys(plan.scriptHashesForPlan).length > 0) {
    lockfileEntry.scriptHashes = {};
    if (plan.scriptHashesForPlan['postInstall']) {
      lockfileEntry.scriptHashes.postInstall = plan.scriptHashesForPlan['postInstall'];
    }
    if (plan.scriptHashesForPlan['postUninstall']) {
      lockfileEntry.scriptHashes.postUninstall = plan.scriptHashesForPlan['postUninstall'];
    }
  }

  const key = lockfileKey ?? plan.asset.name;
  lockfile.installed[key] = lockfileEntry;
  writeLockfile(projectRoot, lockfile);

  // Build script notice for postInstall (task 6.1-6.2)
  let scriptNotice: string | undefined;
  if (plan.manifest?.scripts?.postInstall) {
    // Determine the asset root by finding the common directory prefix of all
    // installed files. This handles folder-based assets (e.g. plugins) where
    // files are nested in subdirectories and the script path is relative to
    // the asset's top-level install folder, not to any individual file's dir.
    let assetDir = projectRoot;
    if (installedFiles.length > 0) {
      const dirParts = installedFiles.map(f => path.dirname(path.join(projectRoot, f)).split(path.sep));
      let common = dirParts[0];
      for (const parts of dirParts.slice(1)) {
        let i = 0;
        while (i < common.length && i < parts.length && common[i] === parts[i]) i++;
        common = common.slice(0, i);
      }
      if (common.length > 0) assetDir = common.join(path.sep);
    }
    const scriptPath = path.join(assetDir, plan.manifest.scripts.postInstall);
    scriptNotice = buildScriptNotice(scriptPath, 'install');
  }

  return {
    asset: plan.asset,
    installedFiles,
    skippedFiles,
    lockfileEntry,
    scriptNotice,
  };
}

/**
 * Build a formatted notice string for a lifecycle script.
 */
export function buildScriptNotice(scriptPath: string, verb: 'install' | 'uninstall'): string {
  const action = verb === 'install' ? 'post-install setup' : 'post-uninstall cleanup';
  return [
    `\n⚠️  This asset has a ${action} script.`,
    `   Run it manually:`,
    `   node ${scriptPath}`,
    '',
  ].join('\n');
}

/**
 * Check whether a folder-based asset's setup script has been run.
 * Returns true if the asset has hasManifest and the installed folder lacks .setup-complete.
 */
export function checkSetupPending(
  projectRoot: string,
  lockfileKey: string,
  installedAsset: InstalledAsset,
): boolean {
  if (!installedAsset.hasManifest) return false;
  if (installedAsset.files.length === 0) return false;

  const firstFile = installedAsset.files[0];
  const assetDir = path.dirname(path.join(projectRoot, firstFile));
  const manifestPath = path.join(assetDir, 'manifest.json');

  try {
    if (!fs.existsSync(manifestPath)) return false;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as AssetManifest;
    if (!manifest.scripts?.postInstall) return false;
    return !fs.existsSync(path.join(assetDir, '.setup-complete'));
  } catch {
    return false;
  }
}

/**
 * Append paths to .gitignore, avoiding duplicates.
 */
function appendToGitignore(projectRoot: string, paths: Set<string>): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  let existing = '';
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  }
  const existingLines = new Set(existing.split('\n').map((l) => l.trim()));
  const toAdd: string[] = [];
  for (const p of paths) {
    if (!existingLines.has(p)) {
      toAdd.push(p);
    }
  }
  if (toAdd.length > 0) {
    const suffix = existing.endsWith('\n') || existing === '' ? '' : '\n';
    fs.writeFileSync(
      gitignorePath,
      existing + suffix + toAdd.join('\n') + '\n',
      'utf-8',
    );
  }
}

/**
 * Convenience wrapper: plan + execute install.
 * For managed file conflicts (already in lockfile), defaults to overwrite.
 * For unmanaged conflicts, calls onProgress to get resolutions from the caller.
 */
export async function installAssetFull(
  asset: RegistryAsset,
  targets: string[],
  scope: 'project' | 'global',
  projectRoot: string,
  registryUrl: string,
  lockfile: Lockfile,
  registryName: string,
  githubToken?: string,
  onProgress?: (conflicts: FileConflict[]) => Promise<Record<string, ConflictResolution>>,
  options?: { skipConfiguredFiles?: boolean; riskAccepted?: boolean; riskAcceptedAt?: string },
): Promise<InstallResult> {
  const { resolvedAsset, lockfileKey } = resolveForInstall(
    asset,
    registryName,
    registryUrl,
    lockfile,
  );

  const plan = await planInstall(
    resolvedAsset,
    targets,
    scope,
    projectRoot,
    lockfile,
    registryUrl,
    githubToken,
  );

  // Build resolutions
  const resolutions: Record<string, ConflictResolution> = {};

  // Managed files default to overwrite
  const managedConflicts = plan.conflicts.filter((c) => c.isManaged);
  for (const conflict of managedConflicts) {
    resolutions[conflict.filePath] = 'overwrite';
  }

  // Unmanaged conflicts need caller input
  const unmanagedConflicts = plan.conflicts.filter((c) => !c.isManaged);
  if (unmanagedConflicts.length > 0 && onProgress) {
    const callerResolutions = await onProgress(unmanagedConflicts);
    Object.assign(resolutions, callerResolutions);
  } else {
    // No callback — default unmanaged to overwrite
    for (const conflict of unmanagedConflicts) {
      resolutions[conflict.filePath] = 'overwrite';
    }
  }

  const result = await executeInstall(plan, resolutions, projectRoot, lockfile, lockfileKey, registryUrl, options);
  if (result.lockfileEntry.reconfigurationNeeded) {
    delete result.lockfileEntry.reconfigurationNeeded;
    lockfile.installed[lockfileKey] = result.lockfileEntry;
    writeLockfile(projectRoot, lockfile);
  }

  return result;
}

/**
 * Dry run: returns the plan without writing anything.
 */
export async function dryRunInstall(
  asset: RegistryAsset,
  targets: string[],
  scope: 'project' | 'global',
  projectRoot: string,
  registryUrl: string,
  lockfile: Lockfile | null,
  githubToken?: string,
): Promise<InstallPlan> {
  return planInstall(
    asset,
    targets,
    scope,
    projectRoot,
    lockfile,
    registryUrl,
    githubToken,
  );
}

/**
 * TUI-compatible installAsset wrapper.
 * Maintains the signature expected by InstallView.tsx.
 */
export async function installAsset(
  asset: RegistryAsset,
  options: InstallOptions & { riskAccepted?: boolean; riskAcceptedAt?: string },
  onProgress?: (status: InstallFileStatus) => void,
): Promise<InstallFileResult> {
  const { scope, targets, projectRoot, registryBaseUrl, registryName, githubToken } = options;

  // Build or load lockfile
  let lockfile: Lockfile;
  const lockfilePath = path.join(projectRoot, 'ai-stash.lock.json');
  if (fs.existsSync(lockfilePath)) {
    lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8')) as Lockfile;
  } else {
    lockfile = {
      version: 2,
      registries: [{ name: registryName, url: registryBaseUrl }],
      installed: {},
    };
  }

  const { resolvedAsset, lockfileKey, suffixApplied, conflictingRegistry } = resolveForInstall(
    asset,
    registryName,
    registryBaseUrl,
    lockfile,
  );

  const fileStatuses: InstallFileStatus[] = (asset.files ?? (asset.file ? [asset.file] : [])).map((f) => ({
    file: f,
    status: 'pending' as const,
  }));

  try {
    const plan = await planInstall(
      resolvedAsset,
      targets,
      scope,
      projectRoot,
      lockfile,
      registryBaseUrl,
      githubToken,
    );

    // Notify progress for each file
    for (const filePath of Object.keys(plan.files)) {
      const relativePath = path.relative(projectRoot, filePath);
      const conflict = plan.conflicts.find((c) => c.filePath === relativePath);

      if (conflict && !conflict.isManaged) {
        const idx = fileStatuses.findIndex((f) => f.file === relativePath || plan.files[filePath] !== undefined);
        if (idx >= 0) {
          fileStatuses[idx] = { file: relativePath, status: 'conflict' };
          onProgress?.({ file: relativePath, status: 'conflict' });
        }
      } else {
        onProgress?.({ file: relativePath, status: 'installing' });
      }
    }

    // Execute with overwrite for all (TUI handles conflicts separately)
    const resolutions: Record<string, ConflictResolution> = {};
    for (const conflict of plan.conflicts) {
      resolutions[conflict.filePath] = 'overwrite';
    }

    const result = await executeInstall(plan, resolutions, projectRoot, lockfile, lockfileKey, registryBaseUrl, {
      riskAccepted: options.riskAccepted,
      riskAcceptedAt: options.riskAcceptedAt,
    });

    // Map to TUI-compatible result
    const resultStatuses: InstallFileStatus[] = result.installedFiles.map((f) => ({
      file: f,
      status: 'done' as const,
    }));
    for (const f of result.skippedFiles) {
      resultStatuses.push({ file: f, status: 'pending' });
    }

    return {
      asset: asset.name,
      files: resultStatuses,
      success: true,
      suffixApplied: suffixApplied
        ? { originalName: asset.name, suffixedName: resolvedAsset.name, conflictingRegistry: conflictingRegistry! }
        : undefined,
      scriptNotice: result.scriptNotice,
    };
  } catch {
    return {
      asset: asset.name,
      files: fileStatuses.map((f) => ({ ...f, status: 'done' as const })),
      success: false,
    };
  }
}

export interface SyncResult {
  installed: string[];
  skipped: string[];  // asset names not found in registry or orphaned
  failed: string[];
  orphaned: string[];
}

/**
 * Batch-install all lockfile entries whose files are missing on disk.
 * Scope and targets are read from the lockfile entry — no user prompting.
 * Orphaned assets (registry name not in registries[]) are skipped.
 */
export async function syncFromLockfile(
  lockfile: Lockfile,
  registryAssets: RegistryAsset[],
  projectRoot: string,
  onProgress?: (assetName: string, status: 'installing' | 'done' | 'skipped' | 'failed' | 'orphaned') => void,
  githubToken?: string,
): Promise<SyncResult> {
  const unsynced = getUnsyncedAssets(lockfile, projectRoot);
  const configuredRegistryNames = new Set(lockfile.registries.map((r) => r.name));

  const result: SyncResult = { installed: [], skipped: [], failed: [], orphaned: [] };

  for (const { name: lockfileKey, asset: lockfileEntry } of unsynced) {
    // Parse registry name from key
    const parts = lockfileKey.split(':');
    const registryName = parts[0];

    // Skip orphaned assets
    if (!configuredRegistryNames.has(registryName)) {
      result.orphaned.push(lockfileKey);
      onProgress?.(lockfileKey, 'orphaned');
      continue;
    }

    // Extract original asset name (last segment(s))
    const assetName = parts.slice(2).join(':');

    // Look up asset in registry by original name
    const registryAsset = registryAssets.find(
      (a) => a.name === assetName && a.registryName === registryName,
    ) ?? registryAssets.find((a) => a.name === assetName);

    if (!registryAsset) {
      result.skipped.push(lockfileKey);
      onProgress?.(lockfileKey, 'skipped');
      continue;
    }

    onProgress?.(lockfileKey, 'installing');
    try {
      const plan = await planInstall(
        registryAsset,
        lockfileEntry.targets,
        lockfileEntry.scope as 'project' | 'global',
        projectRoot,
        lockfile,
        lockfileEntry.registryUrl,
        githubToken,
      );
      // Preserve prior risk acceptance state when re-syncing (task 9.1)
      await executeInstall(plan, {}, projectRoot, lockfile, lockfileKey, lockfileEntry.registryUrl, {
        riskAccepted: lockfileEntry.riskAccepted,
        riskAcceptedAt: lockfileEntry.riskAcceptedAt,
      });
      result.installed.push(lockfileKey);
      onProgress?.(lockfileKey, 'done');
    } catch {
      result.failed.push(lockfileKey);
      onProgress?.(lockfileKey, 'failed');
    }
  }

  return result;
}
