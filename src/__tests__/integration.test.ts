import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
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
};

const mockAssetV2: RegistryAsset = {
  ...mockAsset,
  version: '2.0.0',
};

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
  it('completes the full lifecycle', async () => {
    // === INSTALL ===
    const lockfile: Lockfile = {
      version: 1,
      registry: 'https://example.com',
      installed: {},
    };

    const installPlan = await planInstall(
      mockAsset,
      ['claude-code'],
      'project',
      tmpDir,
      null,
      'https://example.com/',
    );

    const installResult = await executeInstall(installPlan, {}, tmpDir, lockfile);

    // After install: lockfile entry exists
    expect(lockfile.installed['integration-skill']).toBeDefined();
    expect(lockfile.installed['integration-skill'].version).toBe('1.0.0');

    // After install: files are on disk
    for (const file of installResult.installedFiles) {
      const fullPath = path.join(tmpDir, file);
      expect(fs.existsSync(fullPath)).toBe(true);
    }

    // Verify lockfile was written to disk
    const diskLockfile = readLockfile(tmpDir);
    expect(diskLockfile).not.toBeNull();
    expect(diskLockfile!.installed['integration-skill']).toBeDefined();

    // === UPDATE ===
    // Update fetch mock to return v2 content
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
      'https://example.com/',
    );

    // Conflicts should be managed since the asset is already installed
    for (const conflict of updatePlan.conflicts) {
      expect(conflict.isManaged).toBe(true);
    }

    const resolutions: Record<string, 'overwrite'> = {};
    for (const conflict of updatePlan.conflicts) {
      resolutions[conflict.filePath] = 'overwrite';
    }

    const updateResult = await executeInstall(updatePlan, resolutions, tmpDir, lockfile);

    // After update: lockfile version updated
    expect(lockfile.installed['integration-skill'].version).toBe('2.0.0');

    // After update: files replaced with new content
    for (const file of updateResult.installedFiles) {
      const fullPath = path.join(tmpDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(content).toContain('v2');
    }

    // === REMOVE ===
    await removeAssetFull('integration-skill', tmpDir, lockfile);

    // After remove: lockfile entry gone
    expect(lockfile.installed['integration-skill']).toBeUndefined();

    // After remove: files deleted
    for (const file of updateResult.installedFiles) {
      const fullPath = path.join(tmpDir, file);
      expect(fs.existsSync(fullPath)).toBe(false);
    }

    // Verify lockfile on disk is updated
    const finalLockfile = readLockfile(tmpDir);
    expect(finalLockfile).not.toBeNull();
    expect(finalLockfile!.installed['integration-skill']).toBeUndefined();
  });
});
