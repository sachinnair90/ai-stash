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
  /** Single file path for simple assets (skill, agent, instruction, command) */
  file?: string;
  /** Folder path for complex assets (hook, mcp-server, plugin) — engine fetches manifest.json from here */
  folder?: string;
  /** Name of the source registry (populated after multi-registry merge) */
  registryName: string;
}

export interface UserConfigEntry {
  description: string;
  sensitive: boolean;
}

export interface AssetManifest {
  files: string[];
  userConfig?: Record<string, UserConfigEntry>;
  scripts?: {
    postInstall?: string;
    postUninstall?: string;
  };
  configuredFiles?: string[];
  configStable?: boolean;
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
  skills?: Omit<RegistryAsset, 'type' | 'registryName'>[];
  agents?: Omit<RegistryAsset, 'type' | 'registryName'>[];
  instructions?: Omit<RegistryAsset, 'type' | 'registryName'>[];
  commands?: Omit<RegistryAsset, 'type' | 'registryName'>[];
  hooks?: Omit<RegistryAsset, 'type' | 'registryName'>[];
  plugins?: Omit<RegistryAsset, 'type' | 'registryName'>[];
  mcpServers?: Omit<RegistryAsset, 'type' | 'registryName'>[];
}
