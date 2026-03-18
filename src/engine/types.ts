import type { RegistryAsset } from '../registry/types.js';
import type { InstalledAsset } from '../lockfile/types.js';

export type ConflictResolution = 'merge' | 'overwrite' | 'skip';

export type InstallStatus = 'pending' | 'installing' | 'done' | 'skipped' | 'error';

export interface FileConflict {
  filePath: string;
  isManaged: boolean;
}

export interface InstallPlan {
  asset: RegistryAsset;
  targets: string[];
  scope: 'project' | 'global';
  files: Record<string, string>;
  conflicts: FileConflict[];
}

export interface InstallResult {
  asset: RegistryAsset;
  installedFiles: string[];
  skippedFiles: string[];
  lockfileEntry: InstalledAsset;
}
