export interface InstalledAsset {
  type: string;
  version: string;
  installedAt: string;
  targets: string[];
  scope: string;
  files: string[];
}

export interface Lockfile {
  version: 1;
  registry: string;
  installed: Record<string, InstalledAsset>;
}
