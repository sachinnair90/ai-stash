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
    manifestUrl: 'https://example.com/manifest.json',
    ...overrides,
  };
}

describe('getInstallPaths', () => {
  const projectRoot = '/project';

  it('returns correct .github paths for skill', () => {
    const asset = makeAsset({ type: 'skill', files: ['main.md', 'util.md'] });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual([
      '/project/.github/skills/test-asset/main.md',
      '/project/.github/skills/test-asset/util.md',
    ]);
  });

  it('returns correct .github paths for agent', () => {
    const asset = makeAsset({ type: 'agent', name: 'my-agent' });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual(['/project/.github/agents/my-agent.md']);
  });

  it('returns correct paths for instruction', () => {
    const asset = makeAsset({ type: 'instruction' });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual(['/project/AGENTS.md']);
  });

  it('returns correct paths for hook', () => {
    const asset = makeAsset({ type: 'hook' });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual(['/project/.github/hooks/hooks.json']);
  });

  it('returns correct paths for prompt', () => {
    const asset = makeAsset({ type: 'prompt', name: 'my-prompt' });
    const paths = copilotAdapter.getInstallPaths(asset, 'project', projectRoot);
    expect(paths).toEqual(['/project/.github/prompts/my-prompt.prompt.md']);
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
    const asset = makeAsset({ type: 'hook', files: ['hook-config.json'] });
    const hookConfig = JSON.stringify({
      hooks: [
        { name: 'lint', event: 'PreToolUse', command: 'npx eslint' },
        { name: 'test', event: 'PostToolUse', command: 'npm test' },
      ],
    });
    const result = copilotAdapter.transformFiles(asset, { 'hook-config.json': hookConfig });

    const transformed = JSON.parse(Object.values(result)[0]);
    expect(transformed.hooks[0].event).toBe('preToolUse');
    expect(transformed.hooks[0].bash).toBe('npx eslint');
    expect(transformed.hooks[0]).not.toHaveProperty('command');
    expect(transformed.hooks[1].event).toBe('postToolUse');
    expect(transformed.hooks[1].bash).toBe('npm test');
  });

  it('replaces $ARGUMENTS with ${input:args} for prompt', () => {
    const asset = makeAsset({ type: 'prompt' });
    const content = '---\nname: My Prompt\n---\nRun with $ARGUMENTS and more $ARGUMENTS';
    const result = copilotAdapter.transformFiles(asset, { 'prompt.md': content });

    const transformed = Object.values(result)[0];
    expect(transformed).toContain('${input:args}');
    expect(transformed).not.toContain('$ARGUMENTS');
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
    };

    await copilotAdapter.removeAsset(installed, tmpDir);

    // File should be deleted
    expect(fs.existsSync(path.join(skillDir, 'main.md'))).toBe(false);
    // Empty directory should also be removed
    expect(fs.existsSync(skillDir)).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
