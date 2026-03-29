export interface RegistryConfig {
  name: string;
  url: string;
}

export interface InstalledAsset {
  type: string;
  version: string;
  installedAt: string;
  targets: string[];
  scope: string;
  files: string[];
  registryUrl: string;
  hasManifest?: boolean;
  reconfigurationNeeded?: boolean;
}

export interface Lockfile {
  version: 2;
  registries: RegistryConfig[];
  installed: Record<string, InstalledAsset>;
}
