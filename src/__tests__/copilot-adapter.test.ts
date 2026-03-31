import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { copilotAdapter } from '../adapters/copilot/index.js';
import type { RegistryAsset } from '../registry/types.js';
import type { InstalledAsset } from '../lockfile/types.js';

function makeAsset(overrides: Partial<RegistryAsset> = {}): RegistryAsset {
  return {
    name: 'test-asset',
    type: 'skill',
    version: '1.0.0',
    description: 'Test',
    tags: [],
    targets: ['copilot'],
    files: ['main.md'],
    registryName: 'test',
    ...overrides,
  };
}

describe('getInstallPaths', () => {
  const projectRoot = '/project';

  it('returns correct .github paths for skill', () => {
    const asset = makeAsset({ type: 'skill', files: ['skills/test-asset/main.md', 'skills/test-asset/util.md'] });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([
      path.join(projectRoot, '.github', 'skills', 'test-asset', 'main.md'),
      path.join(projectRoot, '.github', 'skills', 'test-asset', 'util.md'),
    ]);
  });

  it('returns correct .github paths for agent', () => {
    const asset = makeAsset({ type: 'agent', name: 'my-agent' });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([path.join(projectRoot, '.github', 'agents', 'my-agent.md')]);
  });

  it('returns correct paths for instruction', () => {
    const asset = makeAsset({ type: 'instruction' });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([path.join(projectRoot, 'AGENTS.md')]);
  });

  it('returns correct paths for hook (old-style)', () => {
    const asset = makeAsset({ type: 'hook' });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([path.join(projectRoot, '.github', 'hooks', 'hooks.json')]);
  });

  it('returns multi-file paths for hook with copilot-hooks.json (new-style)', () => {
    const asset = makeAsset({
      type: 'hook',
      files: [
        'hook-config.json',
        'copilot-hooks.json',
        'hooks/track-ai-edits.mjs',
        'hooks/session-stop.mjs',
        'hooks/session-start.mjs',
        'scripts/prepare-commit-msg.mjs',
        'scripts/post-commit.mjs',
      ],
    });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([
      path.join(projectRoot, '.github', 'hooks', 'hooks.json'),
      path.join(projectRoot, '.github', 'hooks', 'track-ai-edits.mjs'),
      path.join(projectRoot, '.github', 'hooks', 'session-stop.mjs'),
      path.join(projectRoot, '.github', 'hooks', 'session-start.mjs'),
      path.join(projectRoot, '.github', 'hooks', 'git', 'prepare-commit-msg.mjs'),
      path.join(projectRoot, '.github', 'hooks', 'git', 'post-commit.mjs'),
    ]);
  });

  it('returns correct paths for command', () => {
    const asset = makeAsset({ type: 'command', name: 'my-command' });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([path.join(projectRoot, '.github', 'prompts', 'my-command.prompt.md')]);
  });

  it('returns correct paths for plugin', () => {
    const asset = makeAsset({
      type: 'plugin',
      name: 'dev-workflow',
      files: ['plugins/dev-workflow/.claude-plugin/plugin.json', 'plugins/dev-workflow/agents/planner.md'],
    });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([
      path.join(projectRoot, '.github', 'plugins', 'dev-workflow', '.claude-plugin', 'plugin.json'),
      path.join(projectRoot, '.github', 'plugins', 'dev-workflow', 'agents', 'planner.md'),
    ]);
  });

  it('returns .vscode/mcp.json path for mcp-server', () => {
    const asset = makeAsset({ type: 'mcp-server', name: 'github', files: ['mcp-servers/github/mcp.json'] });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([path.join(projectRoot, '.vscode', 'mcp.json')]);
  });
});

describe('transformFiles', () => {
  it('drops Claude-specific frontmatter fields for agent', () => {
    const asset = makeAsset({ type: 'agent' });
    const content = '---\nname: My Agent\npermissionMode: full\nmaxTurns: 5\nmodel: sonnet\ndisallowedTools: Write\ndescription: Test agent\n---\nAgent body';
    const result = copilotAdapter.transformFiles(asset, { 'agent.md': content });

    const transformed = Object.values(result)[0];
    expect(transformed).toContain('name: My Agent');
    expect(transformed).toContain('description: Test agent');
    expect(transformed).not.toContain('permissionMode');
    expect(transformed).not.toContain('maxTurns');
    expect(transformed).not.toContain('model');
    expect(transformed).not.toContain('disallowedTools');
  });

  it('maps PreToolUse to preToolUse and command to bash for hook', () => {
    const asset = makeAsset({ type: 'hook', files: ['hooks/my-hook/hook-config.json'] });
    const hookConfig = JSON.stringify({
      hooks: [
        { name: 'lint', event: 'PreToolUse', command: 'npx eslint' },
        { name: 'test', event: 'PostToolUse', command: 'npm test' },
      ],
    });
    const result = copilotAdapter.transformFiles(asset, { 'hooks/my-hook/hook-config.json': hookConfig });

    const transformed = JSON.parse(Object.values(result)[0]);
    expect(transformed.hooks[0].event).toBe('preToolUse');
    expect(transformed.hooks[0].bash).toBe('npx eslint');
    expect(transformed.hooks[0]).not.toHaveProperty('command');
    expect(transformed.hooks[1].event).toBe('postToolUse');
    expect(transformed.hooks[1].bash).toBe('npm test');
  });

  it('passes through copilot-hooks.json and scripts unchanged for new-style hook', () => {
    const asset = makeAsset({
      type: 'hook',
      files: ['hook-config.json', 'copilot-hooks.json', 'hooks/track.mjs', 'scripts/prepare-commit-msg.mjs'],
    });
    const copilotHooks = JSON.stringify({ version: 1, hooks: { postToolUse: [{ bash: 'node .github/hooks/track.mjs' }] } });
    const files = {
      'hook-config.json': '{"hooks":[]}',
      'copilot-hooks.json': copilotHooks,
      'hooks/track.mjs': '// track',
      'scripts/prepare-commit-msg.mjs': '// commit msg',
    };
    const result = copilotAdapter.transformFiles(asset, files);
    expect(result).not.toHaveProperty('hook-config.json');
    expect(result['copilot-hooks.json']).toBe(copilotHooks);
    expect(result['hooks/track.mjs']).toBe('// track');
    expect(result['scripts/prepare-commit-msg.mjs']).toBe('// commit msg');
  });

  it('replaces $ARGUMENTS with ${input:args} for command', () => {
    const asset = makeAsset({ type: 'command' });
    const content = '---\nname: My Command\n---\nRun with $ARGUMENTS and more $ARGUMENTS';
    const result = copilotAdapter.transformFiles(asset, { 'command.md': content });

    const transformed = Object.values(result)[0];
    expect(transformed).toContain('${input:args}');
    expect(transformed).not.toContain('$ARGUMENTS');
  });

  it('passes through plugin files unchanged', () => {
    const asset = makeAsset({ type: 'plugin', name: 'dev-workflow', files: ['plugins/dev-workflow/.claude-plugin/plugin.json'] });
    const files = { 'plugins/dev-workflow/.claude-plugin/plugin.json': '{"name":"dev-workflow"}' };
    const result = copilotAdapter.transformFiles(asset, files);
    expect(result).toEqual(files);
  });

  it('transforms mcp-server mcpServers → servers key', () => {
    const asset = makeAsset({ type: 'mcp-server', name: 'github', files: ['mcp-servers/github/mcp.json'] });
    const mcpContent = JSON.stringify({ mcpServers: { github: { command: 'npx', args: ['@github/mcp'] } } });
    const result = copilotAdapter.transformFiles(asset, { 'mcp-servers/github/mcp.json': mcpContent });
    const parsed = JSON.parse(Object.values(result)[0]) as Record<string, unknown>;
    expect(parsed).toHaveProperty('servers');
    expect(parsed).not.toHaveProperty('mcpServers');
    expect((parsed.servers as Record<string, unknown>)).toHaveProperty('github');
  });

  it('wraps instruction content in section markers', () => {
    const asset = makeAsset({ type: 'instruction', name: 'my-rules' });
    const files = { 'instructions.md': 'Follow these rules...' };
    const result = copilotAdapter.transformFiles(asset, files);

    const content = Object.values(result)[0];
    expect(content).toContain('<!-- ai-stash:my-rules -->');
    expect(content).toContain('Follow these rules...');
    expect(content).toContain('<!-- /ai-stash:my-rules -->');
  });
});

describe('mergeIntoExisting', () => {
  it('appends new instruction section marker block', () => {
    const existing = '# Existing agents\n';
    const incoming = '<!-- ai-stash:new-rules -->\nNew rules\n<!-- /ai-stash:new-rules -->';
    const result = copilotAdapter.mergeIntoExisting('new-rules', existing, incoming, 'instruction');

    expect(result).toContain('# Existing agents');
    expect(result).toContain('<!-- ai-stash:new-rules -->');
    expect(result).toContain('New rules');
  });

  it('replaces existing section marker block', () => {
    const existing =
      'Before\n<!-- ai-stash:my-rules -->\nOld rules\n<!-- /ai-stash:my-rules -->\nAfter';
    const incoming = '<!-- ai-stash:my-rules -->\nNew rules\n<!-- /ai-stash:my-rules -->';
    const result = copilotAdapter.mergeIntoExisting('my-rules', existing, incoming, 'instruction');

    expect(result).toContain('New rules');
    expect(result).not.toContain('Old rules');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });
});

describe('mergeIntoExisting - mcp-server', () => {
  it('merges servers by key for .vscode/mcp.json', () => {
    const existing = JSON.stringify({ servers: { existing: { command: 'npx', args: ['existing'] } } });
    const incoming = JSON.stringify({ servers: { github: { command: 'npx', args: ['@github/mcp'] } } });
    const result = copilotAdapter.mergeIntoExisting('github', existing, incoming, 'mcp-server');
    const parsed = JSON.parse(result) as { servers: Record<string, unknown> };
    expect(parsed.servers).toHaveProperty('existing');
    expect(parsed.servers).toHaveProperty('github');
  });
});

describe('mergeIntoExisting - hook (new-style)', () => {
  it('merges object-keyed hooks.json by event + bash dedup', () => {
    const existing = JSON.stringify({
      version: 1,
      hooks: { postToolUse: [{ bash: 'node .github/hooks/other.mjs' }] },
    });
    const incoming = JSON.stringify({
      version: 1,
      hooks: {
        sessionStart: [{ bash: 'node .github/hooks/session-start.mjs' }],
        postToolUse: [{ bash: 'node .github/hooks/track-ai-edits.mjs' }],
      },
    });
    const result = copilotAdapter.mergeIntoExisting('ai-coauthor-hook', existing, incoming, 'hook');
    const parsed = JSON.parse(result) as { version: number; hooks: Record<string, unknown[]> };
    expect(parsed.hooks.sessionStart).toHaveLength(1);
    expect(parsed.hooks.postToolUse).toHaveLength(2);   // existing + new, no dup
  });

  it('does not duplicate entries when re-installing', () => {
    const hooksJson = JSON.stringify({
      version: 1,
      hooks: { postToolUse: [{ bash: 'node .github/hooks/track-ai-edits.mjs' }] },
    });
    const result = copilotAdapter.mergeIntoExisting('ai-coauthor-hook', hooksJson, hooksJson, 'hook');
    const parsed = JSON.parse(result) as { hooks: { postToolUse: unknown[] } };
    expect(parsed.hooks.postToolUse).toHaveLength(1);
  });
});

describe('removeAsset', () => {
  it('deletes files using real temp directory', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-remove-cp-'));
    const skillDir = path.join(tmpDir, '.github', 'skills', 'test-asset');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'main.md'), 'content', 'utf-8');

    const installed: InstalledAsset = {
      type: 'skill',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      targets: ['copilot'],
      scope: 'project',
      files: ['.github/skills/test-asset/main.md'],
      registryUrl: 'https://example.com',
    };

    await copilotAdapter.removeAsset(installed, tmpDir);

    // File should be deleted
    expect(fs.existsSync(path.join(skillDir, 'main.md'))).toBe(false);
    // Empty directory should also be removed
    expect(fs.existsSync(skillDir)).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
