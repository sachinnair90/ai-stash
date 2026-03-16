import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock config/paths to use a temp directory for cache
const tmpCacheDir = path.join(os.tmpdir(), `ai-stash-test-cache-${Date.now()}`);
vi.mock('../config/paths.js', () => ({
  getCacheDir: () => tmpCacheDir,
}));

import { readCache, writeCache } from '../registry/cache.js';
import { fetchRegistry } from '../registry/fetcher.js';
import { getRegistry } from '../registry/client.js';
import type { RegistryIndex } from '../registry/types.js';

const sampleRegistry: RegistryIndex = {
  version: 1,
  generatedAt: '2026-01-01T00:00:00Z',
  assets: [
    {
      name: 'test-asset',
      type: 'skill',
      version: '1.0.0',
      description: 'A test asset',
      tags: ['test'],
      targets: ['claude-code'],
      files: ['main.md'],
      manifestUrl: 'https://example.com/manifest.json',
    },
  ],
};

describe('fetchRegistry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and parses valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => sampleRegistry,
      }),
    );

    const result = await fetchRegistry('https://example.com/registry.json');
    expect(result).toEqual(sampleRegistry);
    expect(result.version).toBe(1);
    expect(result.assets).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    await expect(fetchRegistry('https://example.com/registry.json')).rejects.toThrow(
      'Failed to fetch registry',
    );

    vi.unstubAllGlobals();
  });
});

describe('cache write/read roundtrip', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpCacheDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });
  });

  it('preserves data and timestamps', () => {
    writeCache(sampleRegistry);
    const result = readCache(3600);

    expect(result).not.toBeNull();
    expect(result!.data).toEqual(sampleRegistry);
    expect(result!.cacheAge).toBeGreaterThanOrEqual(0);
    expect(result!.cacheAge).toBeLessThan(5000);
  });
});

describe('TTL check', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpCacheDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });
  });

  it('fresh cache returns stale: false', () => {
    writeCache(sampleRegistry);
    const result = readCache(3600); // 1 hour TTL in seconds
    expect(result!.stale).toBe(false);
  });

  it('old cache returns stale: true', () => {
    // Write cache with an old timestamp
    const cachePath = path.join(tmpCacheDir, 'registry.json');
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    const entry = {
      data: sampleRegistry,
      fetchedAt: Date.now() - 7200000, // 2 hours ago
    };
    fs.writeFileSync(cachePath, JSON.stringify(entry), 'utf-8');

    const result = readCache(3600); // 1 hour TTL in seconds
    expect(result!.stale).toBe(true);
  });
});

describe('offline fallback', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpCacheDir, { recursive: true });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it('when fetch throws, returns stale cache data', async () => {
    // Pre-populate cache
    writeCache(sampleRegistry);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const result = await getRegistry({
      registry: { name: 'test', url: 'https://example.com/registry.json' }, defaultTarget: 'claude-code',
      cacheTTL: 3600000,
    });

    expect(result.registry).toEqual(sampleRegistry);
    expect(result.stale).toBe(true);
  });
});

describe('getRegistry', () => {
  afterEach(() => {
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it('throws when no cache and network fails', async () => {
    // Ensure no cache exists
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    await expect(
      getRegistry({
        registry: { name: 'test', url: 'https://example.com/registry.json' }, defaultTarget: 'claude-code',
        cacheTTL: 3600000,
      }),
    ).rejects.toThrow('Failed to fetch registry and no cached data available');
  });
});
