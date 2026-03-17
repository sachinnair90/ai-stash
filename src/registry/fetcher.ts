import type { RegistryIndex, NestedRegistryIndex, RegistryAsset } from './types.js';

const BUCKET_TO_TYPE: Record<string, string> = {
  skills: 'skill',
  agents: 'agent',
  instructions: 'instruction',
  commands: 'command',
  hooks: 'hook',
  plugins: 'plugin',
  mcpServers: 'mcp-server',
  // Legacy: prompts bucket maps to command for backwards compatibility
  prompts: 'command',
};

export async function fetchRegistry(url: string): Promise<RegistryIndex> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch registry: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as NestedRegistryIndex;

  if (typeof data.version !== 'number') {
    throw new Error('Invalid registry format: missing or invalid version field');
  }

  const assets: RegistryAsset[] = [];
  for (const [bucket, type] of Object.entries(BUCKET_TO_TYPE)) {
    const items = (data as unknown as Record<string, unknown>)[bucket] as Omit<RegistryAsset, 'type'>[] | undefined;
    if (items) {
      for (const item of items) {
        assets.push({ ...item, type });
      }
    }
  }

  return {
    version: data.version,
    generatedAt: data.generatedAt,
    assets,
  };
}

export async function fetchAssetFile(baseUrl: string, filePath: string): Promise<string> {
  const url = new URL(filePath, baseUrl).href;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset file ${filePath}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}
