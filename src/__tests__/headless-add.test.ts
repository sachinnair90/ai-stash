import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Lockfile } from '../lockfile/types.js';
import type { RegistryAsset } from '../registry/types.js';
import type { InstallResult } from '../engine/types.js';

vi.mock('../lockfile/index.js', () => ({
  readLockfile: vi.fn(),
  writeLockfile: vi.fn(),
  getUnsyncedAssets: vi.fn(),
}));

vi.mock('../engine/install.js', () => ({
  installAssetFull: vi.fn(),
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

import { readLockfile } from '../lockfile/index.js';
import { installAssetFull } from '../engine/install.js';
import { getRegistries } from '../registry/client.js';
import { handleAddCommand } from '../commands/add.js';

const mockReadLockfile = vi.mocked(readLockfile);
const mockInstallAssetFull = vi.mocked(installAssetFull);
const mockGetRegistries = vi.mocked(getRegistries);

const singleRegistry = { name: 'community', url: 'https://example.com/registry.json' };

const baseLockfile: Lockfile = {
  version: 2,
  registries: [singleRegistry],
  installed: {},
};

const mockAsset: RegistryAsset = {
  name: 'git-commit',
  type: 'skill',
  version: '1.0.0',
  description: 'Test skill',
  tags: ['git'],
  targets: ['claude-code'],
  files: ['assets/git-commit/SKILL.md'],
  manifestUrl: 'https://example.com/manifest.json',
  registryName: 'community',
};

const installResult: InstallResult = {
  asset: mockAsset,
  installedFiles: ['.claude/skills/git-commit/SKILL.md'],
  skippedFiles: [],
  lockfileEntry: {
    type: 'skill',
    version: '1.0.0',
    installedAt: '2026-01-01T00:00:00Z',
    targets: ['claude-code'],
    scope: 'project',
    files: ['.claude/skills/git-commit/SKILL.md'],
    registryUrl: singleRegistry.url,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined): never => {
    throw new Error(`process.exit(${_code})`);
  });
  mockGetRegistries.mockResolvedValue({ assets: [mockAsset], warnings: [] });
  mockInstallAssetFull.mockResolvedValue(installResult);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleAddCommand — add from single registry', () => {
  it('installs the asset and prints confirmation', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    const logSpy = vi.spyOn(console, 'log');

    await handleAddCommand(['skill', 'git-commit']);

    expect(mockInstallAssetFull).toHaveBeenCalledWith(
      mockAsset,
      mockAsset.targets,
      'project',
      '/test/root',
      singleRegistry.url,
      expect.any(Object),
      singleRegistry.name,
      undefined,
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Installed skill 'git-commit' (v1.0.0) [project]"),
    );
  });
});

describe('handleAddCommand — multi-registry auto-select', () => {
  it('auto-selects first registry in non-TTY context and warns to stderr', async () => {
    const acmeRegistry = { name: 'acme', url: 'https://acme.com/registry.json' };
    const multiLockfile: Lockfile = {
      version: 2,
      registries: [singleRegistry, acmeRegistry],
      installed: {},
    };
    mockReadLockfile.mockReturnValue(multiLockfile);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await handleAddCommand(['skill', 'git-commit']);

    expect(mockGetRegistries).toHaveBeenCalledWith([singleRegistry], undefined);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("multiple registries configured, using 'community'"),
    );
  });
});

describe('handleAddCommand — already installed', () => {
  it('exits 0 and prints nothing-to-do when same version is installed', async () => {
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
    mockReadLockfile.mockReturnValue(installedLockfile);
    const logSpy = vi.spyOn(console, 'log');

    await expect(handleAddCommand(['skill', 'git-commit'])).rejects.toThrow('process.exit(0)');
    expect(mockInstallAssetFull).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('already installed (1.0.0), nothing to do');
  });

  it('exits 0 and suggests update when different version is installed', async () => {
    const installedLockfile: Lockfile = {
      version: 2,
      registries: [singleRegistry],
      installed: {
        'community:skill:git-commit': {
          type: 'skill',
          version: '0.9.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/skills/git-commit/SKILL.md'],
          registryUrl: singleRegistry.url,
        },
      },
    };
    mockReadLockfile.mockReturnValue(installedLockfile);
    const logSpy = vi.spyOn(console, 'log');

    await expect(handleAddCommand(['skill', 'git-commit'])).rejects.toThrow('process.exit(0)');
    expect(mockInstallAssetFull).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("already installed (0.9.0), use 'update' to upgrade");
  });
});

describe('handleAddCommand — no registries configured', () => {
  it('exits 1 and prints guidance when no registries are configured', async () => {
    mockReadLockfile.mockReturnValue({ version: 2, registries: [], installed: {} });
    const errorSpy = vi.spyOn(console, 'error');

    await expect(handleAddCommand(['skill', 'git-commit'])).rejects.toThrow('process.exit(1)');
    expect(mockInstallAssetFull).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no registries configured'),
    );
  });
});

describe('handleAddCommand — asset not found', () => {
  it('exits 1 and prints error when asset not in registry', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockGetRegistries.mockResolvedValue({ assets: [], warnings: [] });
    const errorSpy = vi.spyOn(console, 'error');

    await expect(handleAddCommand(['skill', 'nonexistent'])).rejects.toThrow('process.exit(1)');
    expect(mockInstallAssetFull).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("skill 'nonexistent' not found in registry 'community'"));
  });
});

describe('handleAddCommand — --registry flag', () => {
  it('uses the specified registry', async () => {
    const acmeRegistry = { name: 'acme', url: 'https://acme.com/registry.json' };
    const multiLockfile: Lockfile = {
      version: 2,
      registries: [singleRegistry, acmeRegistry],
      installed: {},
    };
    mockReadLockfile.mockReturnValue(multiLockfile);
    mockGetRegistries.mockResolvedValue({
      assets: [{ ...mockAsset, registryName: 'acme' }],
      warnings: [],
    });

    await handleAddCommand(['skill', 'git-commit', '--registry', 'acme']);

    expect(mockGetRegistries).toHaveBeenCalledWith([acmeRegistry], undefined);
  });

  it('exits 1 when --registry names an unknown registry', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    const errorSpy = vi.spyOn(console, 'error');

    await expect(
      handleAddCommand(['skill', 'git-commit', '--registry', 'nonexistent']),
    ).rejects.toThrow('process.exit(1)');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("no registry named 'nonexistent'"));
  });
});

describe('handleAddCommand — --scope flag', () => {
  it('installs at global scope when --scope global is provided', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);

    await handleAddCommand(['skill', 'git-commit', '--scope', 'global']);

    expect(mockInstallAssetFull).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array),
      'global',
      expect.any(String),
      expect.any(String),
      expect.any(Object),
      expect.any(String),
      undefined,
    );
  });
});

describe('handleAddCommand — --target flag', () => {
  it('installs with specified targets', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);

    await handleAddCommand(['skill', 'git-commit', '--target', 'claude-code']);

    expect(mockInstallAssetFull).toHaveBeenCalledWith(
      expect.any(Object),
      ['claude-code'],
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(Object),
      expect.any(String),
      undefined,
    );
  });
});
