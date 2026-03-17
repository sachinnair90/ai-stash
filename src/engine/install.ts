import fs from 'node:fs';
import path from 'node:path';
import type { RegistryAsset } from '../registry/types.js';
import type { Lockfile, InstalledAsset } from '../lockfile/types.js';
import type { Config } from '../config/types.js';
import type { AssetType } from '../adapters/types.js';
import { getAdapter } from '../adapters/index.js';
import { fetchAssetFile } from '../registry/fetcher.js';
import { writeLockfile } from '../lockfile/writer.js';
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
  // Fetch all asset files from registry
  const rawFiles: Record<string, string> = {};
  for (const filePath of asset.files) {
    rawFiles[filePath] = await fetchAssetFile(registryBaseUrl, filePath, githubToken);
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

  // Detect conflicts
  const conflicts: FileConflict[] = [];
  const installedEntry = lockfile?.installed[asset.name];

  for (const filePath of Object.keys(transformedFiles)) {
    const relativePath = path.relative(projectRoot, filePath);
    if (fs.existsSync(filePath)) {
      const isManaged = installedEntry?.files.includes(relativePath) ?? false;
      conflicts.push({ filePath: relativePath, isManaged });
    }
  }

  return {
    asset,
    targets,
    scope,
    files: transformedFiles,
    conflicts,
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
): Promise<InstallResult> {
  const installedFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const [absolutePath, content] of Object.entries(plan.files)) {
    const relativePath = path.relative(projectRoot, absolutePath);
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

  // Update lockfile
  const lockfileEntry: InstalledAsset = {
    type: plan.asset.type,
    version: plan.asset.version,
    installedAt: new Date().toISOString(),
    targets: plan.targets,
    scope: plan.scope,
    files: installedFiles,
  };

  lockfile.installed[plan.asset.name] = lockfileEntry;
  writeLockfile(projectRoot, lockfile);

  return {
    asset: plan.asset,
    installedFiles,
    skippedFiles,
    lockfileEntry,
  };
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
  config: Config,
  lockfile: Lockfile,
  onProgress?: (conflicts: FileConflict[]) => Promise<Record<string, ConflictResolution>>,
): Promise<InstallResult> {
  const plan = await planInstall(
    asset,
    targets,
    scope,
    projectRoot,
    lockfile,
    config.registry.url,
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

  return executeInstall(plan, resolutions, projectRoot, lockfile);
}

/**
 * Dry run: returns the plan without writing anything.
 */
export async function dryRunInstall(
  asset: RegistryAsset,
  targets: string[],
  scope: 'project' | 'global',
  projectRoot: string,
  config: Config,
  lockfile: Lockfile | null,
): Promise<InstallPlan> {
  return planInstall(
    asset,
    targets,
    scope,
    projectRoot,
    lockfile,
    config.registry.url,
  );
}

/**
 * TUI-compatible installAsset wrapper.
 * Maintains the signature expected by InstallView.tsx.
 */
export async function installAsset(
  asset: RegistryAsset,
  options: InstallOptions,
  onProgress?: (status: InstallFileStatus) => void,
): Promise<InstallFileResult> {
  const { scope, targets, projectRoot, registryBaseUrl, githubToken } = options;

  // Build or load lockfile
  let lockfile: Lockfile;
  const lockfilePath = path.join(projectRoot, 'ai-stash.lock.json');
  if (fs.existsSync(lockfilePath)) {
    lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8')) as Lockfile;
  } else {
    lockfile = { version: 1, registry: registryBaseUrl, installed: {} };
  }

  const fileStatuses: InstallFileStatus[] = asset.files.map((f) => ({
    file: f,
    status: 'pending' as const,
  }));

  try {
    const plan = await planInstall(
      asset,
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

    const result = await executeInstall(plan, resolutions, projectRoot, lockfile);

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
    };
  } catch {
    return {
      asset: asset.name,
      files: fileStatuses.map((f) => ({ ...f, status: 'done' as const })),
      success: false,
    };
  }
}
