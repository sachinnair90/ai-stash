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
  // Use cache when it's still fresh
  const cached = readCache(config.cacheTTL);
  if (cached && !cached.stale) {
    return { registry: cached.data, stale: false, cacheAge: cached.cacheAge };
  }

  // Cache missing or expired — fetch fresh data
  try {
    const registry = await fetchRegistry(config.registry.url, config.githubToken);
    writeCache(registry);
    return { registry, stale: false, cacheAge: 0 };
  } catch {
    // Network failure — fall back to stale cache if available
    if (cached) {
      return { registry: cached.data, stale: true, cacheAge: cached.cacheAge };
    }
    throw new Error('Failed to fetch registry and no cached data available');
  }
}
