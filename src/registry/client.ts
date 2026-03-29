import type { RegistryConfig } from '../lockfile/types.js';
import type { RegistryAsset, RegistryIndex } from './types.js';
import { readCache, writeCache } from './cache.js';
import { fetchRegistry } from './fetcher.js';

export interface RegistryWarning {
  registryName: string;
  message: string;
  cacheAge: number;
}

export interface RegistriesResult {
  assets: RegistryAsset[];
  warnings: RegistryWarning[];
}

export async function getRegistries(
  registries: RegistryConfig[],
  githubToken?: string,
): Promise<RegistriesResult> {
  const results = await Promise.allSettled(
    registries.map((reg) => fetchOneRegistry(reg, githubToken)),
  );

  const allAssets: RegistryAsset[] = [];
  const warnings: RegistryWarning[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const reg = registries[i];

    if (result.status === 'fulfilled') {
      const { assets, warning } = result.value;
      allAssets.push(...assets);
      if (warning) warnings.push(warning);
    } else {
      warnings.push({
        registryName: reg.name,
        message: `Failed to load registry "${reg.name}": ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        cacheAge: 0,
      });
    }
  }

  return { assets: allAssets, warnings };
}

async function fetchOneRegistry(
  reg: RegistryConfig,
  githubToken?: string,
): Promise<{ assets: RegistryAsset[]; warning: RegistryWarning | null }> {
  const cached = readCache(reg.url);
  if (cached && !cached.stale) {
    return {
      assets: tagged(cached.data.assets, reg.name),
      warning: null,
    };
  }

  try {
    const index = await fetchRegistry(reg.url, githubToken);
    writeCache(reg.url, index);
    return { assets: tagged(index.assets, reg.name), warning: null };
  } catch {
    if (cached) {
      const mins = Math.round(cached.cacheAge / 60000);
      return {
        assets: tagged(cached.data.assets, reg.name),
        warning: {
          registryName: reg.name,
          message: `Using cached data for "${reg.name}" (${mins}m old)`,
          cacheAge: cached.cacheAge,
        },
      };
    }
    throw new Error(`Failed to fetch registry "${reg.name}" and no cached data available`);
  }
}

function tagged(assets: RegistryAsset[], registryName: string): RegistryAsset[] {
  return assets.map((a) => ({ ...a, registryName }));
}
