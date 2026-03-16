import type { Config } from '../config/types.js';
import type { RegistryIndex } from './types.js';
import { readCache, writeCache } from './cache.js';
import { fetchRegistry } from './fetcher.js';

export interface RegistryResult {
  registry: RegistryIndex;
  stale: boolean;
  cacheAge: number;
}

export async function getRegistry(config: Config): Promise<RegistryResult> {
  // Try fetching fresh data
  try {
    const registry = await fetchRegistry(config.registry.url);
    writeCache(registry);
    return { registry, stale: false, cacheAge: 0 };
  } catch {
    // Network failure — fall back to cache
    const cached = readCache(config.cacheTTL);
    if (cached) {
      return {
        registry: cached.data,
        stale: true,
        cacheAge: cached.cacheAge,
      };
    }
    throw new Error('Failed to fetch registry and no cached data available');
  }
}
