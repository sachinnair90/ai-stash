import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { RegistryAsset } from '../registry/types.js';
import type { Lockfile } from '../lockfile/types.js';

// Register adapters
import '../adapters/index.js';

import { planInstall, executeInstall } from '../engine/install.js';
import { removeAssetFull } from '../engine/update.js';
import { readLockfile, writeLockfile } from '../lockfile/index.js';

let tmpDir: string;

const mockAsset: RegistryAsset = {
  name: 'integration-skill',
  type: 'skill',
  version: '1.0.0',
  description: 'Integration test skill',
  tags: ['test'],
  targets: ['claude-code'],
  files: ['main.md'],
  manifestUrl: 'https://example.com/manifest.json',
  registryName: 'community',
};

const mockAssetV2: RegistryAsset = {
  ...mockAsset,
  version: '2.0.0',
};

const REGISTRY_URL = 'https://example.com';
const LOCKFILE_KEY = 'community:skill:integration-skill';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-integration-'));

  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      text: async () => `# Integration Skill v1\nContent from ${url}`,
      json: async () => ({}),
    })),
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('full install -> update -> remove cycle', () => {
  it('completes the full lifecycle with registry:type:name key format', async () => {
    // === INSTALL ===
    const lockfile: Lockfile = {
      version: 2,
      registries: [{ name: 'community', url: REGISTRY_URL }],
      installed: {},
    };

    const installPlan = await planInstall(
      mockAsset,
      ['claude-code'],
      'project',
      tmpDir,
      null,
      REGISTRY_URL + '/',
    );

    const installResult = await executeInstall(installPlan, {}, tmpDir, lockfile, LOCKFILE_KEY, REGISTRY_URL);

    // After install: lockfile entry exists with registry:type:name key
    expect(lockfile.installed[LOCKFILE_KEY]).toBeDefined();
    expect(lockfile.installed[LOCKFILE_KEY].version).toBe('1.0.0');
    expect(lockfile.installed[LOCKFILE_KEY].registryUrl).toBe(REGISTRY_URL);

    // After install: files are on disk
    for (const file of installResult.installedFiles) {
      const fullPath = path.join(tmpDir, file);
      expect(fs.existsSync(fullPath)).toBe(true);
    }

    // Verify lockfile was written to disk
    const diskLockfile = readLockfile(tmpDir);
    expect(diskLockfile).not.toBeNull();
    expect(diskLockfile!.installed[LOCKFILE_KEY]).toBeDefined();
    expect(diskLockfile!.registries).toHaveLength(1);

    // === UPDATE ===
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => ({
        ok: true,
        text: async () => `# Integration Skill v2\nUpdated content from ${url}`,
        json: async () => ({}),
      })),
    );

    const updatePlan = await planInstall(
      mockAssetV2,
      ['claude-code'],
      'project',
      tmpDir,
      lockfile,
      REGISTRY_URL + '/',
    );

    for (const conflict of updatePlan.conflicts) {
      expect(conflict.isManaged).toBe(true);
    }

    const resolutions: Record<string, 'overwrite'> = {};
    for (const conflict of updatePlan.conflicts) {
      resolutions[conflict.filePath] = 'overwrite';
    }

    const updateResult = await executeInstall(updatePlan, resolutions, tmpDir, lockfile, LOCKFILE_KEY, REGISTRY_URL);

    expect(lockfile.installed[LOCKFILE_KEY].version).toBe('2.0.0');

    for (const file of updateResult.installedFiles) {
      const fullPath = path.join(tmpDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(content).toContain('v2');
    }

    // === REMOVE ===
    await removeAssetFull(LOCKFILE_KEY, tmpDir, lockfile);

    expect(lockfile.installed[LOCKFILE_KEY]).toBeUndefined();

    for (const file of updateResult.installedFiles) {
      const fullPath = path.join(tmpDir, file);
      expect(fs.existsSync(fullPath)).toBe(false);
    }

    const finalLockfile = readLockfile(tmpDir);
    expect(finalLockfile).not.toBeNull();
    expect(finalLockfile!.installed[LOCKFILE_KEY]).toBeUndefined();
  });
});

describe('multi-registry conflict suffix', () => {
  it('applies suffix when same type+name exists from different registry', async () => {
    const lockfile: Lockfile = {
      version: 2,
      registries: [
        { name: 'community', url: REGISTRY_URL },
        { name: 'acme', url: 'https://acme.com' },
      ],
      installed: {
        'community:skill:integration-skill': {
          type: 'skill',
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/skills/integration-skill/main.md'],
          registryUrl: REGISTRY_URL,
        },
      },
    };
    writeLockfile(tmpDir, lockfile);

    const acmeAsset: RegistryAsset = { ...mockAsset, registryName: 'acme' };

    // installAsset uses resolveForInstall internally
    const { resolveForInstall } = await import('../engine/install.js');
    const resolved = resolveForInstall(acmeAsset, 'acme', 'https://acme.com', lockfile);

    expect(resolved.suffixApplied).toBe(true);
    expect(resolved.resolvedAsset.name).toBe('integration-skill-acme');
    expect(resolved.lockfileKey).toBe('acme:skill:integration-skill');
  });
});

describe('orphaned assets', () => {
  it('getUnsyncedAssets excludes orphaned entries', async () => {
    const { getUnsyncedAssets } = await import('../lockfile/index.js');

    const lockfile: Lockfile = {
      version: 2,
      registries: [{ name: 'community', url: REGISTRY_URL }],
      installed: {
        // Orphaned: registry "removed-registry" not in registries[]
        'removed-registry:skill:orphan': {
          type: 'skill',
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/skills/orphan/main.md'],
          registryUrl: 'https://removed.com',
        },
        // Non-orphaned but missing from disk
        'community:skill:missing': {
          type: 'skill',
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/skills/missing/main.md'],
          registryUrl: REGISTRY_URL,
        },
      },
    };

    const unsynced = getUnsyncedAssets(lockfile, tmpDir);
    // Should only include non-orphaned missing assets
    expect(unsynced.some((u) => u.name === 'community:skill:missing')).toBe(true);
    expect(unsynced.some((u) => u.name === 'removed-registry:skill:orphan')).toBe(false);
  });
});
