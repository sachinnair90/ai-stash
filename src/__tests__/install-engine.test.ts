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
  resolveForInstall,
  syncFromLockfile,
  hashScriptContent,
} from '../engine/install.js';
import { fetchScriptRisks } from '../registry/fetcher.js';

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
  registryName: 'community',
};

const emptyLockfile: Lockfile = {
  version: 2,
  registries: [{ name: 'community', url: 'https://example.com' }],
  installed: {},
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-engine-test-'));
  vi.restoreAllMocks();

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

describe('resolveForInstall', () => {
  it('returns original asset and no suffix when no conflict', () => {
    const result = resolveForInstall(sampleAsset, 'community', 'https://example.com', emptyLockfile);
    expect(result.suffixApplied).toBe(false);
    expect(result.resolvedAsset.name).toBe('test-skill');
    expect(result.lockfileKey).toBe('community:skill:test-skill');
  });

  it('detects cross-registry conflict and applies suffix', () => {
    const lockfileWithConflict: Lockfile = {
      version: 2,
      registries: [
        { name: 'community', url: 'https://example.com' },
        { name: 'acme', url: 'https://acme.com' },
      ],
      installed: {
        'community:skill:test-skill': {
          type: 'skill',
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/skills/test-skill/main.md'],
          registryUrl: 'https://example.com',
        },
      },
    };

    // Installing test-skill from 'acme' when 'community' already has it
    const result = resolveForInstall(sampleAsset, 'acme', 'https://acme.com', lockfileWithConflict);
    expect(result.suffixApplied).toBe(true);
    expect(result.resolvedAsset.name).toBe('test-skill-acme');
    expect(result.lockfileKey).toBe('acme:skill:test-skill');
    expect(result.conflictingRegistry).toBe('community');
  });

  it('no conflict for same registry reinstall', () => {
    const lockfileWithEntry: Lockfile = {
      version: 2,
      registries: [{ name: 'community', url: 'https://example.com' }],
      installed: {
        'community:skill:test-skill': {
          type: 'skill',
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/skills/test-skill/main.md'],
          registryUrl: 'https://example.com',
        },
      },
    };

    const result = resolveForInstall(sampleAsset, 'community', 'https://example.com', lockfileWithEntry);
    expect(result.suffixApplied).toBe(false);
    expect(result.resolvedAsset.name).toBe('test-skill');
  });
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

    const filePath = Object.keys(plan.files)[0];
    expect(filePath).toContain('.claude/skills/test-skill');
  });

  it('detects managed conflict (file in lockfile.installed key.files)', async () => {
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'main.md'), 'Old content', 'utf-8');

    const lockfileWithAsset: Lockfile = {
      version: 2,
      registries: [{ name: 'community', url: 'https://example.com' }],
      installed: {
        'community:skill:test-skill': {
          type: 'skill',
          version: '0.9.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/skills/test-skill/main.md'],
          registryUrl: 'https://example.com',
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
    const plan = await dryRunInstall(
      sampleAsset,
      ['claude-code'],
      'project',
      tmpDir,
      'https://example.com/',
      null,
    );

    expect(plan.asset).toEqual(sampleAsset);
    expect(Object.keys(plan.files).length).toBeGreaterThan(0);

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

    const lockfile: Lockfile = { ...emptyLockfile, installed: {} };
    const lockfileKey = 'community:skill:test-skill';
    const result = await executeInstall(plan, {}, tmpDir, lockfile, lockfileKey, 'https://example.com');

    expect(result.installedFiles.length).toBeGreaterThan(0);
    expect(result.skippedFiles).toHaveLength(0);
    expect(result.lockfileEntry.version).toBe('1.0.0');
    expect(result.lockfileEntry.registryUrl).toBe('https://example.com');

    const writtenPath = path.join(tmpDir, result.installedFiles[0]);
    expect(fs.existsSync(writtenPath)).toBe(true);

    expect(lockfile.installed[lockfileKey]).toBeDefined();
    expect(lockfile.installed[lockfileKey].version).toBe('1.0.0');
  });

  it('skips file on skip resolution', async () => {
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

    const resolutions: Record<string, 'skip'> = {};
    for (const conflict of plan.conflicts) {
      resolutions[conflict.filePath] = 'skip';
    }

    const lockfile: Lockfile = { ...emptyLockfile, installed: {} };
    const result = await executeInstall(plan, resolutions, tmpDir, lockfile);

    expect(result.skippedFiles.length).toBeGreaterThan(0);
    const content = fs.readFileSync(path.join(skillDir, 'main.md'), 'utf-8');
    expect(content).toBe('Existing content');
  });
});

// ──────────────────────────────────────────────────────────────────────
// hashScriptContent (task 12.1)
// ──────────────────────────────────────────────────────────────────────

describe('hashScriptContent', () => {
  it('returns a 64-char hex sha256 string', () => {
    const hash = hashScriptContent('console.log("hello");');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns different hashes for different content', () => {
    expect(hashScriptContent('version 1')).not.toBe(hashScriptContent('version 2'));
  });

  it('returns the same hash for identical content', () => {
    const content = '// my script';
    expect(hashScriptContent(content)).toBe(hashScriptContent(content));
  });
});

// ──────────────────────────────────────────────────────────────────────
// Script hashes written to lockfile on install (tasks 12.1 / 13.1)
// ──────────────────────────────────────────────────────────────────────

describe('planInstall + executeInstall — script hashes', () => {
  const scriptContent = '// setup script v1';

  const pluginAsset: RegistryAsset = {
    name: 'my-plugin',
    type: 'plugin',
    version: '1.0.0',
    description: 'Plugin with setup script',
    tags: ['test'],
    targets: ['claude-code'],
    files: ['plugins/my-plugin/setup.js'],
    manifestUrl: 'https://example.com/plugins/my-plugin/manifest.json',
    folder: 'plugins/my-plugin',
    registryName: 'community',
  };

  beforeEach(() => {
    // Override fetch for this describe block: manifest returns scripts, other URLs return script content
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('manifest.json')) {
          return {
            ok: true,
            json: async () => ({
              files: ['plugins/my-plugin/setup.js'],
              scripts: { postInstall: 'plugins/my-plugin/setup.js' },
            }),
            text: async () => '',
          };
        }
        return {
          ok: true,
          text: async () => scriptContent,
          json: async () => ({}),
        };
      }),
    );
  });

  it('plan includes scriptHashesForPlan computed from rawFiles', async () => {
    const plan = await planInstall(
      pluginAsset,
      ['claude-code'],
      'project',
      tmpDir,
      null,
      'https://example.com/',
    );

    expect(plan.scriptHashesForPlan).toBeDefined();
    expect(plan.scriptHashesForPlan!['postInstall']).toBe(hashScriptContent(scriptContent));
  });

  it('executeInstall writes scriptHashes to the lockfile entry', async () => {
    const plan = await planInstall(
      pluginAsset,
      ['claude-code'],
      'project',
      tmpDir,
      null,
      'https://example.com/',
    );

    const lockfile: Lockfile = { ...emptyLockfile, installed: {} };
    const lockfileKey = 'community:plugin:my-plugin';
    await executeInstall(plan, {}, tmpDir, lockfile, lockfileKey, 'https://example.com');

    const entry = lockfile.installed[lockfileKey];
    expect(entry).toBeDefined();
    expect(entry.scriptHashes).toBeDefined();
    expect(entry.scriptHashes!.postInstall).toBe(hashScriptContent(scriptContent));
  });
});

// ──────────────────────────────────────────────────────────────────────
// fetchScriptRisks — graceful null on failure (task 12.4)
// ──────────────────────────────────────────────────────────────────────

describe('fetchScriptRisks', () => {
  it('returns null when fetch returns non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }),
    );
    const result = await fetchScriptRisks('https://example.com/', 'plugins/dev-workflow/SCRIPT_RISKS.md');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));
    const result = await fetchScriptRisks('https://example.com/', 'plugins/dev-workflow/SCRIPT_RISKS.md');
    expect(result).toBeNull();
  });

  it('returns text content on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => '## Risks\nSome risk.' }),
    );
    const result = await fetchScriptRisks('https://example.com/', 'plugins/dev-workflow/SCRIPT_RISKS.md');
    expect(result).toBe('## Risks\nSome risk.');
  });
});

// ──────────────────────────────────────────────────────────────────────
// syncFromLockfile preserves riskAccepted (task 13.6)
// ──────────────────────────────────────────────────────────────────────

describe('syncFromLockfile — preserves riskAccepted', () => {
  beforeEach(() => {
    // Restore default fetch mock for sync tests
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '# Test Skill\nThis is the skill content.',
        json: async () => ({}),
      }),
    );
  });

  it('preserves riskAccepted and riskAcceptedAt from the original lockfile entry', async () => {
    const riskAcceptedAt = '2024-01-01T00:00:00.000Z';
    const lockfileWithRisk: Lockfile = {
      version: 2,
      registries: [{ name: 'community', url: 'https://example.com' }],
      installed: {
        'community:skill:test-skill': {
          type: 'skill',
          version: '1.0.0',
          installedAt: '2024-01-01T00:00:00.000Z',
          targets: ['claude-code'],
          scope: 'project',
          // Use a relative path that doesn't exist in tmpDir → unsynced
          files: ['.claude/skills/test-skill/main.md'],
          registryUrl: 'https://example.com',
          riskAccepted: true,
          riskAcceptedAt,
        },
      },
    };

    const registryAssets: RegistryAsset[] = [sampleAsset];

    await syncFromLockfile(lockfileWithRisk, registryAssets, tmpDir);

    const entry = lockfileWithRisk.installed['community:skill:test-skill'];
    expect(entry.riskAccepted).toBe(true);
    expect(entry.riskAcceptedAt).toBe(riskAcceptedAt);
  });
});
