import type { RegistryIndex, NestedRegistryIndex, RegistryAsset, AssetManifest } from './types.js';

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

function authHeaders(token?: string): HeadersInit {
  return token ? { Authorization: `token ${token}` } : {};
}

export async function fetchRegistry(url: string, token?: string): Promise<RegistryIndex> {
  const response = await fetch(url, { headers: authHeaders(token) });
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
        assets.push({ ...item, type, registryName: '' });
      }
    }
  }

  return {
    version: data.version,
    generatedAt: data.generatedAt,
    assets,
  };
}

export async function fetchAssetFile(baseUrl: string, filePath: string, token?: string): Promise<string> {
  const url = new URL(filePath, baseUrl).href;
  const response = await fetch(url, { headers: authHeaders(token) });
  if (!response.ok) {
    throw new Error(`Failed to fetch asset file ${filePath}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export async function fetchManifest(baseUrl: string, folder: string, githubToken?: string): Promise<AssetManifest> {
  const manifestPath = `${folder}/manifest.json`;
  const url = new URL(manifestPath, baseUrl).href;
  const response = await fetch(url, { headers: authHeaders(githubToken) });
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest for folder "${folder}": ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as AssetManifest;

  if (!Array.isArray(data.files)) {
    throw new Error(`Invalid manifest for folder "${folder}": missing or invalid "files" array`);
  }

  return data;
}

/**
 * Fetch the SCRIPT_RISKS.md content for an asset manifest.
 * Returns the file's text on success, or null if the fetch fails (network error or 4xx/5xx).
 */
export async function fetchScriptRisks(
  baseUrl: string,
  scriptRisksPath: string,
  token?: string,
): Promise<string | null> {
  try {
    const url = new URL(scriptRisksPath, baseUrl).href;
    const response = await fetch(url, { headers: authHeaders(token) });
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}
