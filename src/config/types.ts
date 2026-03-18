export interface RegistryConfig {
  name: string;
  url: string;
}

export interface Config {
  registry: RegistryConfig;
  cacheTTL: number; // seconds
  defaultTarget: string;
  githubToken?: string;
}

export const DEFAULT_CONFIG: Config = {
  registry: {
    name: 'ai-stash-registry',
    url: 'https://raw.githubusercontent.com/ai-stash/registry/main/registry.json',
  },
  cacheTTL: 3600, // 1 hour
  defaultTarget: 'claude-code',
};
