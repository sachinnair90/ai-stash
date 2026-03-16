import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { RegistryAsset } from '../registry/types.js';
import type { Lockfile } from '../lockfile/types.js';

// Register adapters
import '../adapters/index.js';

import {
  planInstall,
  executeInstall,
  dryRunInstall,
} from '../engine/install.js';

let tmpDir: string;

const sampleAsset: RegistryAsset = {
  name: 'test-skill',
  type: 'skill',
  version: '1.0.0',
  description: 'A test skill',
  tags: ['test'],
  targets: ['claude-code'],
  files: ['main.md'],
  manifestUrl: 'https://example.com/manifest.json',
};

const emptyLockfile: Lockfile = {
  version: 1,
  registry: 'https://example.com',
  installed: {},
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-engine-test-'));
  vi.restoreAllMocks();

  // Mock fetchAssetFile to return content
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '# Test Skill\nThis is the skill content.',
      json: async () => ({}),
    }),
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('planInstall', () => {
  it('returns plan with correct file paths and no conflicts for fresh install', async () => {
    const plan = await planInstall(
      sampleAsset,
      ['claude-code'],
      'project',
      tmpDir,
      null,
      'https://example.com/',
    );

    expect(plan.asset).toEqual(sampleAsset);
    expect(plan.targets).toEqual(['claude-code']);
    expect(plan.scope).toBe('project');
    expect(Object.keys(plan.files).length).toBeGreaterThan(0);
    expect(plan.conflicts).toHaveLength(0);

    // Check that file path contains the expected structure
    const filePath = Object.keys(plan.files)[0];
    expect(filePath).toContain('.claude/skills/test-skill');
  });

  it('detects managed conflict (file in lockfile.installed[name].files)', async () => {
    // Create the file that will conflict
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'main.md'), 'Old content', 'utf-8');

    const lockfileWithAsset: Lockfile = {
      version: 1,
      registry: 'https://example.com',
      installed: {
        'test-skill': {
          type: 'skill',
          version: '0.9.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/skills/test-skill/main.md'],
        },
      },
    };

    const plan = await planInstall(
      sampleAsset,
      ['claude-code'],
      'project',
      tmpDir,
      lockfileWithAsset,
      'https://example.com/',
    );

    expect(plan.conflicts.length).toBeGreaterThan(0);
    expect(plan.conflicts[0].isManaged).toBe(true);
  });

  it('detects unmanaged conflict (file exists but not in lockfile)', async () => {
    // Create the file that will conflict
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'main.md'), 'Pre-existing content', 'utf-8');

    const plan = await planInstall(
      sampleAsset,
      ['claude-code'],
      'project',
      tmpDir,
      emptyLockfile,
      'https://example.com/',
    );

    expect(plan.conflicts.length).toBeGreaterThan(0);
    expect(plan.conflicts[0].isManaged).toBe(false);
  });
});

describe('dryRunInstall', () => {
  it('returns plan without writing any files', async () => {
    const config = { registry: { name: 'test', url: 'https://example.com/' }, cacheTTL: 3600, defaultTarget: 'claude-code' };

    const plan = await dryRunInstall(
      sampleAsset,
      ['claude-code'],
      'project',
      tmpDir,
      config,
      null,
    );

    expect(plan.asset).toEqual(sampleAsset);
    expect(Object.keys(plan.files).length).toBeGreaterThan(0);

    // Verify no files were actually written
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'test-skill');
    expect(fs.existsSync(skillDir)).toBe(false);
  });
});

describe('executeInstall', () => {
  it('writes files and updates lockfile on overwrite resolution', async () => {
    const plan = await planInstall(
      sampleAsset,
      ['claude-code'],
      'project',
      tmpDir,
      null,
      'https://example.com/',
    );

    const lockfile: Lockfile = { ...emptyLockfile };
    const result = await executeInstall(plan, {}, tmpDir, lockfile);

    expect(result.installedFiles.length).toBeGreaterThan(0);
    expect(result.skippedFiles).toHaveLength(0);
    expect(result.lockfileEntry.version).toBe('1.0.0');

    // Verify file was written
    const writtenPath = path.join(tmpDir, result.installedFiles[0]);
    expect(fs.existsSync(writtenPath)).toBe(true);

    // Verify lockfile was updated
    expect(lockfile.installed['test-skill']).toBeDefined();
    expect(lockfile.installed['test-skill'].version).toBe('1.0.0');
  });

  it('skips file on skip resolution', async () => {
    // Create conflicting file
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'main.md'), 'Existing content', 'utf-8');

    const plan = await planInstall(
      sampleAsset,
      ['claude-code'],
      'project',
      tmpDir,
      emptyLockfile,
      'https://example.com/',
    );

    // Set skip resolution for the conflict
    const resolutions: Record<string, 'skip'> = {};
    for (const conflict of plan.conflicts) {
      resolutions[conflict.filePath] = 'skip';
    }

    const lockfile: Lockfile = { ...emptyLockfile, installed: {} };
    const result = await executeInstall(plan, resolutions, tmpDir, lockfile);

    expect(result.skippedFiles.length).toBeGreaterThan(0);
    // Original content should be preserved
    const content = fs.readFileSync(path.join(skillDir, 'main.md'), 'utf-8');
    expect(content).toBe('Existing content');
  });
});
