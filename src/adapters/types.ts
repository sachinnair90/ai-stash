import type { RegistryAsset } from '../registry/types.js';
import type { InstalledAsset } from '../lockfile/types.js';

export type AssetType = 'skill' | 'agent' | 'instruction' | 'hook' | 'prompt';

export interface Adapter {
  name: string;
  getInstallPaths(asset: RegistryAsset, scope: 'project' | 'global', projectRoot: string): string[];
  transformFiles(asset: RegistryAsset, files: Record<string, string>): Record<string, string>;
  mergeIntoExisting(assetName: string, existing: string, incoming: string, assetType: AssetType): string;
  removeAsset(asset: InstalledAsset, projectRoot: string): Promise<void>;
}
