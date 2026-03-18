import fs from 'node:fs';
import path from 'node:path';
import { getCacheDir } from '../config/paths.js';
import type { RegistryIndex } from './types.js';

interface CacheEntry {
  data: RegistryIndex;
  fetchedAt: number;
}

export interface CacheResult {
  data: RegistryIndex;
  stale: boolean;
  cacheAge: number;
}

function getCachePath(): string {
  return path.join(getCacheDir(), 'registry.json');
}

export function readCache(ttl: number): CacheResult | null {
  const cachePath = getCachePath();
  if (!fs.existsSync(cachePath)) {
    return null;
  }

  const raw = fs.readFileSync(cachePath, 'utf-8');
  let entry: CacheEntry;
  try {
    entry = JSON.parse(raw) as CacheEntry;
  } catch {
    // Corrupted cache — treat as miss
    return null;
  }
  const cacheAge = Date.now() - entry.fetchedAt;

  return {
    data: entry.data,
    stale: cacheAge > ttl * 1000,
    cacheAge,
  };
}

export function writeCache(data: RegistryIndex): void {
  const cachePath = getCachePath();
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });

  const entry: CacheEntry = {
    data,
    fetchedAt: Date.now(),
  };

  fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
}
