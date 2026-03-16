export interface RegistryAsset {
  name: string;
  type: string;
  version: string;
  description: string;
  tags: string[];
  targets: string[];
  files: string[];
  manifestUrl: string;
}

export interface RegistryIndex {
  version: number;
  generatedAt: string;
  assets: RegistryAsset[];
}
