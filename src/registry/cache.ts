import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getCacheDir } from '../config/paths.js';
import type { RegistryIndex } from './types.js';

const CACHE_TTL = 3600; // seconds

interface CacheEntry {
  data: RegistryIndex;
  fetchedAt: number;
}

export interface CacheResult {
  data: RegistryIndex;
  stale: boolean;
  cacheAge: number;
}

function urlHash(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 12);
}

function getCachePath(url: string): string {
  return path.join(getCacheDir(), `registry-${urlHash(url)}.json`);
}

export function readCache(url: string): CacheResult | null {
  const cachePath = getCachePath(url);
  if (!fs.existsSync(cachePath)) {
    return null;
  }

  const raw = fs.readFileSync(cachePath, 'utf-8');
  let entry: CacheEntry;
  try {
    entry = JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
  const cacheAge = Date.now() - entry.fetchedAt;

  return {
    data: entry.data,
    stale: cacheAge > CACHE_TTL * 1000,
    cacheAge,
  };
}

export function writeCache(url: string, data: RegistryIndex): void {
  const cachePath = getCachePath(url);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });

  const entry: CacheEntry = {
    data,
    fetchedAt: Date.now(),
  };

  fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
}
