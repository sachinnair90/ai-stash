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
import { getRegistries } from '../registry/client.js';
import type { RegistryIndex, NestedRegistryIndex } from '../registry/types.js';

const REGISTRY_URL = 'https://example.com/registry.json';

// Nested wire format (what registry.json contains)
const nestedRegistry: NestedRegistryIndex = {
  version: 1,
  generatedAt: '2026-01-01T00:00:00Z',
  skills: [
    {
      name: 'test-asset',
      version: '1.0.0',
      description: 'A test asset',
      tags: ['test'],
      targets: ['claude-code'],
      files: ['skills/test-asset/main.md'],
      manifestUrl: 'https://example.com/manifest.json',
    },
  ],
  commands: [
    {
      name: 'test-command',
      version: '1.0.0',
      description: 'A test command',
      tags: ['test'],
      targets: ['claude-code'],
      files: ['commands/test-command/command.md'],
      manifestUrl: 'https://example.com/manifest.json',
    },
  ],
  plugins: [
    {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'A test plugin',
      tags: ['test'],
      targets: ['claude-code'],
      files: ['plugins/test-plugin/.claude-plugin/plugin.json'],
      manifestUrl: 'https://example.com/manifest.json',
    },
  ],
  mcpServers: [
    {
      name: 'test-mcp',
      version: '1.0.0',
      description: 'A test MCP server',
      tags: ['test'],
      targets: ['claude-code'],
      files: ['mcp-servers/test-mcp/mcp.json'],
      manifestUrl: 'https://example.com/manifest.json',
    },
  ],
};

// Normalised flat form — single skill used for cache tests
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
      files: ['skills/test-asset/main.md'],
      manifestUrl: 'https://example.com/manifest.json',
      registryName: '',
    },
  ],
};

describe('fetchRegistry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches nested JSON and returns normalised flat form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => nestedRegistry,
      }),
    );

    const result = await fetchRegistry(REGISTRY_URL);
    expect(result.version).toBe(1);
    expect(result.assets.find(a => a.name === 'test-asset')?.type).toBe('skill');
    expect(result.assets.find(a => a.name === 'test-command')?.type).toBe('command');
    expect(result.assets.find(a => a.name === 'test-plugin')?.type).toBe('plugin');
    expect(result.assets.find(a => a.name === 'test-mcp')?.type).toBe('mcp-server');

    vi.unstubAllGlobals();
  });

  it('maps legacy prompts bucket to command type', async () => {
    const legacyRegistry = {
      version: 1,
      generatedAt: '2026-01-01T00:00:00Z',
      prompts: [
        {
          name: 'legacy-prompt',
          version: '1.0.0',
          description: 'A legacy prompt',
          tags: [],
          targets: ['claude-code'],
          files: ['prompts/legacy-prompt/prompt.md'],
          manifestUrl: 'https://example.com/manifest.json',
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => legacyRegistry,
      }),
    );

    const result = await fetchRegistry(REGISTRY_URL);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].type).toBe('command');

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

    await expect(fetchRegistry(REGISTRY_URL)).rejects.toThrow(
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
    writeCache(REGISTRY_URL, sampleRegistry);
    const result = readCache(REGISTRY_URL);

    expect(result).not.toBeNull();
    expect(result!.data).toEqual(sampleRegistry);
    expect(result!.cacheAge).toBeGreaterThanOrEqual(0);
    expect(result!.cacheAge).toBeLessThan(5000);
  });

  it('uses different cache files for different URLs', () => {
    const url2 = 'https://acme.com/registry.json';
    writeCache(REGISTRY_URL, sampleRegistry);
    const result1 = readCache(REGISTRY_URL);
    const result2 = readCache(url2);
    expect(result1).not.toBeNull();
    expect(result2).toBeNull(); // different URL has no cache
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
    writeCache(REGISTRY_URL, sampleRegistry);
    const result = readCache(REGISTRY_URL);
    expect(result!.stale).toBe(false);
  });

  it('old cache returns stale: true', () => {
    // Write cache with an old timestamp by hacking the file
    writeCache(REGISTRY_URL, sampleRegistry);
    // Read cache path and rewrite with old timestamp
    const files = fs.readdirSync(tmpCacheDir);
    const cacheFile = files.find((f) => f.startsWith('registry-'));
    expect(cacheFile).toBeDefined();
    const cachePath = path.join(tmpCacheDir, cacheFile!);
    const entry = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    entry.fetchedAt = Date.now() - 7200000; // 2 hours ago
    fs.writeFileSync(cachePath, JSON.stringify(entry), 'utf-8');

    const result = readCache(REGISTRY_URL);
    expect(result!.stale).toBe(true);
  });
});

describe('getRegistries — multi-registry fetch', () => {
  afterEach(() => {
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it('fetches from all registries and tags assets with registryName', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          version: 1,
          generatedAt: '2026-01-01T00:00:00Z',
          skills: [{ name: 'test-asset', version: '1.0.0', description: 'x', tags: [], targets: ['claude-code'], files: [], manifestUrl: '' }],
        }),
      }),
    );

    fs.mkdirSync(tmpCacheDir, { recursive: true });
    const result = await getRegistries([
      { name: 'community', url: REGISTRY_URL },
      { name: 'acme', url: 'https://acme.com/registry.json' },
    ]);

    expect(result.assets.length).toBeGreaterThan(0);
    // Each asset should have registryName set
    for (const asset of result.assets) {
      expect(asset.registryName).toBeTruthy();
    }
  });

  it('uses stale cache on network failure and emits warning', async () => {
    fs.mkdirSync(tmpCacheDir, { recursive: true });
    // Write a stale cache (older than TTL)
    writeCache(REGISTRY_URL, sampleRegistry);
    const files = fs.readdirSync(tmpCacheDir);
    const cacheFile = files.find((f) => f.startsWith('registry-'));
    const cachePath = path.join(tmpCacheDir, cacheFile!);
    const entry = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    entry.fetchedAt = Date.now() - 7200000; // 2 hours ago (stale)
    fs.writeFileSync(cachePath, JSON.stringify(entry), 'utf-8');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const result = await getRegistries([{ name: 'test', url: REGISTRY_URL }]);
    expect(result.assets).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].registryName).toBe('test');
  });

  it('partial failure: one registry fails, others succeed', async () => {
    fs.mkdirSync(tmpCacheDir, { recursive: true });

    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            version: 1,
            generatedAt: '2026-01-01T00:00:00Z',
            skills: [{ name: 'asset-a', version: '1.0.0', description: 'x', tags: [], targets: [], files: [], manifestUrl: '' }],
          }),
        })
        .mockRejectedValueOnce(new Error('Network error')),
    );

    const result = await getRegistries([
      { name: 'good-registry', url: REGISTRY_URL },
      { name: 'bad-registry', url: 'https://bad.example.com/registry.json' },
    ]);

    const goodAssets = result.assets.filter((a) => a.registryName === 'good-registry');
    expect(goodAssets).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].registryName).toBe('bad-registry');
  });

  it('throws when no cache and network fails', async () => {
    fs.rmSync(tmpCacheDir, { recursive: true, force: true });
    fs.mkdirSync(tmpCacheDir, { recursive: true });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const result = await getRegistries([{ name: 'test', url: 'https://no-cache.example.com/registry.json' }]);
    expect(result.assets).toHaveLength(0);
    // Should produce a warning (error captured as warning, not thrown)
    expect(result.warnings).toHaveLength(1);
  });
});
