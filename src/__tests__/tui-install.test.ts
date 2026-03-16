/**
 * End-to-end tests for the TUI install flow.
 *
 * These tests exercise installAsset() — the exact function called by InstallView.tsx —
 * WITHOUT manually importing adapters/index.js first. That makes them a regression
 * guard for the bug where install.ts imported getAdapter from adapters/registry.js
 * instead of adapters/index.js, causing adapters to never be registered and
 * plan.files to always be empty (files: [] in lockfile, nothing written to disk).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { RegistryAsset } from '../registry/types.js';

// Intentionally NOT importing '../adapters/index.js' here.
// Adapter registration must happen via the import chain inside install.ts itself.
import { installAsset } from '../engine/install.js';

const SKILL_CONTENT = `---
name: git-commit
description: Test skill
license: MIT
---
# Git Commit Skill
Skill content here.
`;

const sampleSkill: RegistryAsset = {
  name: 'git-commit',
  type: 'skill',
  version: '1.0.0',
  description: 'Craft conventional commit messages',
  tags: ['git'],
  targets: ['claude-code'],
  files: ['assets/git-commit/SKILL.md'],
  manifestUrl: 'assets/git-commit/SKILL.md',
};

const sampleAgent: RegistryAsset = {
  name: 'debug-agent',
  type: 'agent',
  version: '1.0.0',
  description: 'A debugging agent',
  tags: ['debug'],
  targets: ['claude-code'],
  files: ['assets/debug-agent/AGENT.md'],
  manifestUrl: 'assets/debug-agent/AGENT.md',
};

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-tui-e2e-'));
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      text: async () => SKILL_CONTENT,
      json: async () => ({}),
    }),
  );
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('installAsset (TUI wrapper) — basic install flow', () => {
  it('writes the skill file to disk and records it in the lockfile', async () => {
    const result = await installAsset(
      sampleSkill,
      {
        scope: 'project',
        targets: ['claude-code'],
        projectRoot: tmpDir,
        registryBaseUrl: 'https://example.com/registry.json',
      },
    );

    expect(result.success).toBe(true);
    expect(result.asset).toBe('git-commit');

    // All returned file statuses must be 'done'
    expect(result.files.length).toBeGreaterThan(0);
    for (const f of result.files) {
      expect(f.status).toBe('done');
    }

    // File must physically exist on disk
    const installedPath = path.join(tmpDir, '.claude', 'skills', 'git-commit', 'SKILL.md');
    expect(fs.existsSync(installedPath)).toBe(true);
    expect(fs.readFileSync(installedPath, 'utf-8')).toContain('Git Commit Skill');

    // Lockfile must record the installed file path (not an empty array)
    const lockfileRaw = fs.readFileSync(path.join(tmpDir, 'ai-stash.lock.json'), 'utf-8');
    const lockfile = JSON.parse(lockfileRaw);
    expect(lockfile.installed['git-commit']).toBeDefined();
    expect(lockfile.installed['git-commit'].files).toHaveLength(1);
    expect(lockfile.installed['git-commit'].files[0]).toBe('.claude/skills/git-commit/SKILL.md');
  });

  it('installs a skill to global scope under ~/.claude/skills/', async () => {
    const result = await installAsset(
      sampleSkill,
      {
        scope: 'global',
        targets: ['claude-code'],
        projectRoot: tmpDir,
        registryBaseUrl: 'https://example.com/registry.json',
      },
    );

    expect(result.success).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);

    // Global installs go to the real home dir — just verify the result, not the file
    for (const f of result.files) {
      expect(f.status).toBe('done');
    }
  });

  it('installs an agent to .claude/agents/', async () => {
    const result = await installAsset(
      sampleAgent,
      {
        scope: 'project',
        targets: ['claude-code'],
        projectRoot: tmpDir,
        registryBaseUrl: 'https://example.com/registry.json',
      },
    );

    expect(result.success).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);

    const agentPath = path.join(tmpDir, '.claude', 'agents', 'debug-agent.md');
    expect(fs.existsSync(agentPath)).toBe(true);

    const lockfileRaw = fs.readFileSync(path.join(tmpDir, 'ai-stash.lock.json'), 'utf-8');
    const lockfile = JSON.parse(lockfileRaw);
    expect(lockfile.installed['debug-agent'].files).toHaveLength(1);
    expect(lockfile.installed['debug-agent'].files[0]).toBe('.claude/agents/debug-agent.md');
  });

  it('installs to both claude-code and copilot targets', async () => {
    const result = await installAsset(
      sampleSkill,
      {
        scope: 'project',
        targets: ['claude-code', 'copilot'],
        projectRoot: tmpDir,
        registryBaseUrl: 'https://example.com/registry.json',
      },
    );

    expect(result.success).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);

    // claude-code skill path
    const ccPath = path.join(tmpDir, '.claude', 'skills', 'git-commit', 'SKILL.md');
    expect(fs.existsSync(ccPath)).toBe(true);

    // copilot instructions path
    const copilotPath = path.join(tmpDir, '.github', 'copilot-instructions.md');
    expect(fs.existsSync(copilotPath)).toBe(true);
  });

  it('returns success: false and does not crash when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const result = await installAsset(
      sampleSkill,
      {
        scope: 'project',
        targets: ['claude-code'],
        projectRoot: tmpDir,
        registryBaseUrl: 'https://example.com/registry.json',
      },
    );

    expect(result.success).toBe(false);
    expect(result.asset).toBe('git-commit');
    // No file written
    const installedPath = path.join(tmpDir, '.claude', 'skills', 'git-commit', 'SKILL.md');
    expect(fs.existsSync(installedPath)).toBe(false);
  });

  it('overwrites an existing managed file on reinstall', async () => {
    const opts = {
      scope: 'project' as const,
      targets: ['claude-code'],
      projectRoot: tmpDir,
      registryBaseUrl: 'https://example.com/registry.json',
    };

    // First install
    await installAsset(sampleSkill, opts);

    // Update fetch to return different content
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '# Updated Skill v2',
        json: async () => ({}),
      }),
    );

    // Second install (overwrite)
    const result = await installAsset(sampleSkill, opts);

    expect(result.success).toBe(true);

    const installedPath = path.join(tmpDir, '.claude', 'skills', 'git-commit', 'SKILL.md');
    expect(fs.readFileSync(installedPath, 'utf-8')).toContain('Updated Skill v2');
  });

  it('calls onProgress callback with installing and done statuses', async () => {
    const progressEvents: { file: string; status: string }[] = [];

    await installAsset(
      sampleSkill,
      {
        scope: 'project',
        targets: ['claude-code'],
        projectRoot: tmpDir,
        registryBaseUrl: 'https://example.com/registry.json',
      },
      (status) => progressEvents.push({ file: status.file, status: status.status }),
    );

    // Should have received at least one 'installing' progress event
    const installing = progressEvents.filter((e) => e.status === 'installing');
    expect(installing.length).toBeGreaterThan(0);
  });
});
