import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Lockfile } from '../lockfile/types.js';

vi.mock('../lockfile/index.js', () => ({
  readLockfile: vi.fn(),
  writeLockfile: vi.fn(),
}));

vi.mock('../engine/update.js', () => ({
  removeAssetFull: vi.fn(),
}));

vi.mock('../config/paths.js', () => ({
  getProjectRoot: vi.fn().mockReturnValue('/test/root'),
}));

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn().mockImplementation(() => {
    throw new Error('gh not available');
  }),
}));

import { readLockfile } from '../lockfile/index.js';
import { removeAssetFull } from '../engine/update.js';
import { handleRemoveCommand } from '../commands/remove.js';

const mockReadLockfile = vi.mocked(readLockfile);
const mockRemoveAssetFull = vi.mocked(removeAssetFull);

const singleRegistry = { name: 'community', url: 'https://example.com/registry.json' };

const installedLockfile: Lockfile = {
  version: 2,
  registries: [singleRegistry],
  installed: {
    'community:skill:git-commit': {
      type: 'skill',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      targets: ['claude-code'],
      scope: 'project',
      files: ['.claude/skills/git-commit/SKILL.md'],
      registryUrl: singleRegistry.url,
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined): never => {
    throw new Error(`process.exit(${_code})`);
  });
  mockRemoveAssetFull.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleRemoveCommand — successful remove', () => {
  it('calls removeAssetFull with the correct lockfile key and prints confirmation', async () => {
    mockReadLockfile.mockReturnValue(installedLockfile);
    const logSpy = vi.spyOn(console, 'log');

    await handleRemoveCommand(['skill', 'git-commit']);

    expect(mockRemoveAssetFull).toHaveBeenCalledWith(
      'community:skill:git-commit',
      '/test/root',
      installedLockfile,
    );
    expect(logSpy).toHaveBeenCalledWith("Removed skill 'git-commit'");
  });
});

describe('handleRemoveCommand — not installed', () => {
  it('exits 1 and prints error when no lockfile exists', async () => {
    mockReadLockfile.mockReturnValue(null);
    const errorSpy = vi.spyOn(console, 'error');

    await expect(handleRemoveCommand(['skill', 'git-commit'])).rejects.toThrow('process.exit(1)');
    expect(mockRemoveAssetFull).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("skill 'git-commit' is not installed"));
  });

  it('exits 1 and prints error when asset is not in lockfile', async () => {
    const emptyLockfile: Lockfile = {
      version: 2,
      registries: [singleRegistry],
      installed: {},
    };
    mockReadLockfile.mockReturnValue(emptyLockfile);
    const errorSpy = vi.spyOn(console, 'error');

    await expect(handleRemoveCommand(['skill', 'git-commit'])).rejects.toThrow('process.exit(1)');
    expect(mockRemoveAssetFull).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("skill 'git-commit' is not installed"));
  });
});
