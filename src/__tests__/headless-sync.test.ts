import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Lockfile } from '../lockfile/types.js';
import type { RegistryAsset } from '../registry/types.js';
import type { SyncResult } from '../engine/install.js';

vi.mock('../lockfile/index.js', () => ({
  readLockfile: vi.fn(),
  writeLockfile: vi.fn(),
  getUnsyncedAssets: vi.fn(),
}));

vi.mock('../engine/install.js', () => ({
  syncFromLockfile: vi.fn(),
}));

vi.mock('../registry/client.js', () => ({
  getRegistries: vi.fn(),
}));

vi.mock('../config/paths.js', () => ({
  getProjectRoot: vi.fn().mockReturnValue('/test/root'),
}));

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn().mockImplementation(() => {
    throw new Error('gh not available');
  }),
}));

import { readLockfile, getUnsyncedAssets } from '../lockfile/index.js';
import { syncFromLockfile } from '../engine/install.js';
import { getRegistries } from '../registry/client.js';
import { handleSyncCommand } from '../commands/sync.js';

const mockReadLockfile = vi.mocked(readLockfile);
const mockGetUnsyncedAssets = vi.mocked(getUnsyncedAssets);
const mockSyncFromLockfile = vi.mocked(syncFromLockfile);
const mockGetRegistries = vi.mocked(getRegistries);

const singleRegistry = { name: 'community', url: 'https://example.com/registry.json' };

const installedEntry = {
  type: 'skill',
  version: '1.0.0',
  installedAt: '2026-01-01T00:00:00Z',
  targets: ['claude-code'],
  scope: 'project',
  files: ['.claude/skills/git-commit/SKILL.md'],
  registryUrl: singleRegistry.url,
};

const baseLockfile: Lockfile = {
  version: 2,
  registries: [singleRegistry],
  installed: {
    'community:skill:git-commit': installedEntry,
  },
};

const mockAssets: RegistryAsset[] = [
  {
    name: 'git-commit',
    type: 'skill',
    version: '1.0.0',
    description: 'Test skill',
    tags: ['git'],
    targets: ['claude-code'],
    file: 'assets/git-commit/SKILL.md',
    registryName: 'community',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined): never => {
    throw new Error(`process.exit(${_code})`);
  });
  mockGetRegistries.mockResolvedValue({ assets: mockAssets, warnings: [] });
  mockSyncFromLockfile.mockResolvedValue({
    installed: ['community:skill:git-commit'],
    skipped: [],
    failed: [],
    orphaned: [],
  } as SyncResult);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleSyncCommand — sync restores missing assets', () => {
  it('calls syncFromLockfile and prints progress for missing assets', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockGetUnsyncedAssets.mockReturnValue([
      { name: 'community:skill:git-commit', asset: installedEntry },
    ]);

    await handleSyncCommand([]);

    expect(mockSyncFromLockfile).toHaveBeenCalledWith(
      baseLockfile,
      mockAssets,
      '/test/root',
      expect.any(Function),
      undefined,
    );
  });
});

describe('handleSyncCommand — all assets present', () => {
  it('exits 0 and prints all-in-sync message when nothing to sync', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockGetUnsyncedAssets.mockReturnValue([]); // nothing unsynced
    const logSpy = vi.spyOn(console, 'log');

    await expect(handleSyncCommand([])).rejects.toThrow('process.exit(0)');
    expect(mockSyncFromLockfile).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('all assets are in sync');
  });
});

describe('handleSyncCommand — orphaned assets are skipped', () => {
  it('calls syncFromLockfile which handles orphaned assets internally', async () => {
    const orphanedEntry = {
      ...installedEntry,
      registryUrl: 'https://orphaned.com/registry.json',
    };
    const lockfileWithOrphaned: Lockfile = {
      version: 2,
      registries: [singleRegistry], // 'orphaned-registry' is NOT in registries
      installed: {
        'community:skill:git-commit': installedEntry,
        'orphaned-registry:skill:old-skill': orphanedEntry,
      },
    };
    mockReadLockfile.mockReturnValue(lockfileWithOrphaned);
    mockGetUnsyncedAssets.mockReturnValue([
      { name: 'community:skill:git-commit', asset: installedEntry },
    ]);
    mockSyncFromLockfile.mockResolvedValue({
      installed: ['community:skill:git-commit'],
      skipped: [],
      failed: [],
      orphaned: ['orphaned-registry:skill:old-skill'],
    } as SyncResult);

    await handleSyncCommand([]);

    expect(mockSyncFromLockfile).toHaveBeenCalled();
  });
});

describe('handleSyncCommand — no lockfile', () => {
  it('exits 0 and prints no-lockfile message', async () => {
    mockReadLockfile.mockReturnValue(null);
    const logSpy = vi.spyOn(console, 'log');

    await expect(handleSyncCommand([])).rejects.toThrow('process.exit(0)');
    expect(mockSyncFromLockfile).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('no lockfile found, nothing to sync');
  });
});
