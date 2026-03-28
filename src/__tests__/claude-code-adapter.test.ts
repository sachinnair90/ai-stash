import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { claudeCodeAdapter } from '../adapters/claude-code/index.js';
import type { RegistryAsset } from '../registry/types.js';
import type { InstalledAsset } from '../lockfile/types.js';

function makeAsset(overrides: Partial<RegistryAsset> = {}): RegistryAsset {
  return {
    name: 'test-asset',
    type: 'skill',
    version: '1.0.0',
    description: 'Test',
    tags: [],
    targets: ['claude-code'],
    files: ['main.md'],
    manifestUrl: 'https://example.com/manifest.json',
    registryName: 'test',
    ...overrides,
  };
}

describe('getInstallPaths', () => {
  const projectRoot = '/project';

  it('returns correct paths for skill - project scope', () => {
    const asset = makeAsset({ type: 'skill', files: ['main.md', 'util.md'] });
    const paths = claudeCodeAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([
      '/project/.claude/skills/test-asset/main.md',
      '/project/.claude/skills/test-asset/util.md',
    ]);
  });

  it('returns correct paths for skill - global scope', () => {
    const asset = makeAsset({ type: 'skill', files: ['main.md'] });
    const paths = claudeCodeAdapter.getInstallPaths(asset, 'global', projectRoot);
    expect(paths[0]).toContain('.claude/skills/test-asset/main.md');
    // Global paths use os.homedir()
    expect(paths[0]).not.toContain('/project');
  });

  it('returns correct paths for agent', () => {
    const asset = makeAsset({ type: 'agent', name: 'my-agent' });
    const paths = claudeCodeAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual(['/project/.claude/agents/my-agent.md']);
  });

  it('returns correct paths for instruction', () => {
    const asset = makeAsset({ type: 'instruction' });
    const paths = claudeCodeAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual(['/project/CLAUDE.md']);
  });

  it('returns correct paths for hook', () => {
    const asset = makeAsset({ type: 'hook', name: 'my-hook', files: ['hooks/my-hook/hook-config.json', 'hooks/my-hook/check.sh'] });
    const paths = claudeCodeAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([
      '/project/.claude/settings.json',
      '/project/.claude/hooks/my-hook/check.sh',
    ]);
  });

  it('returns correct paths for command', () => {
    const asset = makeAsset({ type: 'command', name: 'my-command' });
    const paths = claudeCodeAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual(['/project/.claude/skills/my-command/SKILL.md']);
  });

  it('returns correct paths for plugin', () => {
    const asset = makeAsset({
      type: 'plugin',
      name: 'dev-workflow',
      files: ['plugins/dev-workflow/.claude-plugin/plugin.json', 'plugins/dev-workflow/skills/commit/SKILL.md'],
    });
    const paths = claudeCodeAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([
      '/project/.claude/plugins/dev-workflow/.claude-plugin/plugin.json',
      '/project/.claude/plugins/dev-workflow/skills/commit/SKILL.md',
    ]);
  });

  it('returns .mcp.json path for mcp-server (project scope)', () => {
    const asset = makeAsset({ type: 'mcp-server', name: 'github', files: ['mcp-servers/github/mcp.json'] });
    const paths = claudeCodeAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual(['/project/.mcp.json']);
  });
});

describe('transformFiles', () => {
  it('wraps instruction content in section markers', () => {
    const asset = makeAsset({ type: 'instruction', name: 'coding-standards' });
    const files = { 'instructions.md': 'Follow these rules...' };
    const result = claudeCodeAdapter.transformFiles(asset, files);

    const content = Object.values(result)[0];
    expect(content).toContain('<!-- ai-stash:coding-standards -->');
    expect(content).toContain('Follow these rules...');
    expect(content).toContain('<!-- /ai-stash:coding-standards -->');
  });

  it('adds disable-model-invocation: true to command frontmatter', () => {
    const asset = makeAsset({ type: 'command', name: 'my-command' });
    const files = { 'SKILL.md': '---\nname: My Command\n---\nContent here' };
    const result = claudeCodeAdapter.transformFiles(asset, files);

    const content = Object.values(result)[0];
    expect(content).toContain('disable-model-invocation: true');
  });

  it('adds frontmatter with disable-model-invocation when command has no frontmatter', () => {
    const asset = makeAsset({ type: 'command', name: 'my-command' });
    const files = { 'SKILL.md': 'Just content, no frontmatter' };
    const result = claudeCodeAdapter.transformFiles(asset, files);

    const content = Object.values(result)[0];
    expect(content).toContain('---\ndisable-model-invocation: true\n---');
  });

  it('passes through plugin files unchanged', () => {
    const asset = makeAsset({ type: 'plugin', name: 'dev-workflow', files: ['plugins/dev-workflow/.claude-plugin/plugin.json'] });
    const files = { 'plugins/dev-workflow/.claude-plugin/plugin.json': '{"name":"dev-workflow"}' };
    const result = claudeCodeAdapter.transformFiles(asset, files);
    expect(result).toEqual(files);
  });

  it('extracts mcpServers from mcp-server asset mcp.json', () => {
    const asset = makeAsset({ type: 'mcp-server', name: 'github', files: ['mcp-servers/github/mcp.json'] });
    const mcpContent = JSON.stringify({ mcpServers: { github: { command: 'npx', args: ['@github/mcp'] } } });
    const result = claudeCodeAdapter.transformFiles(asset, { 'mcp-servers/github/mcp.json': mcpContent });
    const parsed = JSON.parse(Object.values(result)[0]);
    expect(parsed).toHaveProperty('mcpServers.github');
  });

  it('passes through skill files unchanged', () => {
    const asset = makeAsset({ type: 'skill' });
    const files = { 'main.md': 'Skill content' };
    const result = claudeCodeAdapter.transformFiles(asset, files);
    expect(result).toEqual(files);
  });

  it('filters out hook-config.json for hook type', () => {
    const asset = makeAsset({ type: 'hook', files: ['hooks/my-hook/hook-config.json', 'hooks/my-hook/check.sh'] });
    const files = { 'hooks/my-hook/hook-config.json': '{"hooks":[]}', 'hooks/my-hook/check.sh': '#!/bin/bash' };
    const result = claudeCodeAdapter.transformFiles(asset, files);
    expect(result).not.toHaveProperty('hooks/my-hook/hook-config.json');
    expect(result['hooks/my-hook/check.sh']).toBe('#!/bin/bash');
  });
});

describe('mergeIntoExisting', () => {
  it('appends new instruction section marker block', () => {
    const existing = '# Existing content\n';
    const incoming = '<!-- ai-stash:new-rules -->\nNew rules\n<!-- /ai-stash:new-rules -->';
    const result = claudeCodeAdapter.mergeIntoExisting('new-rules', existing, incoming, 'instruction');

    expect(result).toContain('# Existing content');
    expect(result).toContain('<!-- ai-stash:new-rules -->');
    expect(result).toContain('New rules');
  });

  it('replaces existing section marker block', () => {
    const existing =
      'Before\n<!-- ai-stash:my-rules -->\nOld rules\n<!-- /ai-stash:my-rules -->\nAfter';
    const incoming = '<!-- ai-stash:my-rules -->\nNew rules\n<!-- /ai-stash:my-rules -->';
    const result = claudeCodeAdapter.mergeIntoExisting('my-rules', existing, incoming, 'instruction');

    expect(result).toContain('New rules');
    expect(result).not.toContain('Old rules');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });
});

describe('mergeIntoExisting - mcp-server', () => {
  it('merges mcpServers by key', () => {
    const existing = JSON.stringify({ mcpServers: { existing: { command: 'npx', args: ['existing'] } } });
    const incoming = JSON.stringify({ mcpServers: { github: { command: 'npx', args: ['@github/mcp'] } } });
    const result = claudeCodeAdapter.mergeIntoExisting('github', existing, incoming, 'mcp-server');
    const parsed = JSON.parse(result) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers).toHaveProperty('existing');
    expect(parsed.mcpServers).toHaveProperty('github');
  });

  it('overwrites existing server key on merge', () => {
    const existing = JSON.stringify({ mcpServers: { github: { command: 'old' } } });
    const incoming = JSON.stringify({ mcpServers: { github: { command: 'new' } } });
    const result = claudeCodeAdapter.mergeIntoExisting('github', existing, incoming, 'mcp-server');
    const parsed = JSON.parse(result) as { mcpServers: { github: { command: string } } };
    expect(parsed.mcpServers.github.command).toBe('new');
  });
});

describe('removeAsset', () => {
  it('deletes files using real temp directory', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-remove-cc-'));
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'test-asset');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'main.md'), 'content', 'utf-8');

    const installed: InstalledAsset = {
      type: 'skill',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      targets: ['claude-code'],
      scope: 'project',
      files: ['.claude/skills/test-asset/main.md'],
      registryUrl: 'https://example.com',
    };

    await claudeCodeAdapter.removeAsset(installed, tmpDir);

    // File should be deleted
    expect(fs.existsSync(path.join(skillDir, 'main.md'))).toBe(false);
    // Empty directory should also be removed
    expect(fs.existsSync(skillDir)).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
