export interface RegistryAsset {
  name: string;
  type: string;
  version: string;
  description: string;
  tags: string[];
  targets: string[];
  /** Registry-root-relative paths, e.g. "skills/foo/main.md" */
  files: string[];
  manifestUrl: string;
}

/** Normalised flat form used internally throughout the engine and UI */
export interface RegistryIndex {
  version: number;
  generatedAt: string;
  assets: RegistryAsset[];
}

/** Over-the-wire format from registry.json — assets nested under typed buckets */
export interface NestedRegistryIndex {
  version: number;
  generatedAt: string;
  skills?: Omit<RegistryAsset, 'type'>[];
  agents?: Omit<RegistryAsset, 'type'>[];
  instructions?: Omit<RegistryAsset, 'type'>[];
  prompts?: Omit<RegistryAsset, 'type'>[];
  hooks?: Omit<RegistryAsset, 'type'>[];
}
