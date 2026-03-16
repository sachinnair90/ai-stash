import type { RegistryIndex } from './types.js';

export async function fetchRegistry(url: string): Promise<RegistryIndex> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch registry: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as RegistryIndex;

  if (typeof data.version !== 'number') {
    throw new Error('Invalid registry format: missing or invalid version field');
  }

  return data;
}

export async function fetchAssetFile(baseUrl: string, filePath: string): Promise<string> {
  const url = new URL(filePath, baseUrl).href;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset file ${filePath}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}
