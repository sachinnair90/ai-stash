import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Lockfile } from '../lockfile/types.js';
import type { RegistryAsset } from '../registry/types.js';
import type { InstallResult } from '../engine/types.js';

vi.mock('../lockfile/index.js', () => ({
  readLockfile: vi.fn(),
  writeLockfile: vi.fn(),
}));

vi.mock('../engine/update.js', () => ({
  checkUpdates: vi.fn(),
  updateAssetFull: vi.fn(),
  planUpdateFull: vi.fn(),
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

const mockCreateInterface = vi.fn();
vi.mock('node:readline', () => ({
  default: { createInterface: (...args: unknown[]) => mockCreateInterface(...args) },
  createInterface: (...args: unknown[]) => mockCreateInterface(...args),
}));

import { readLockfile } from '../lockfile/index.js';
import { checkUpdates, updateAssetFull, planUpdateFull } from '../engine/update.js';
import { getRegistries } from '../registry/client.js';
import { handleUpdateCommand } from '../commands/update.js';

const mockReadLockfile = vi.mocked(readLockfile);
const mockCheckUpdates = vi.mocked(checkUpdates);
const mockUpdateAssetFull = vi.mocked(updateAssetFull);
const mockPlanUpdateFull = vi.mocked(planUpdateFull);
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

const mockAsset: RegistryAsset = {
  name: 'git-commit',
  type: 'skill',
  version: '2.0.0',
  description: 'Test skill',
  tags: ['git'],
  targets: ['claude-code'],
  files: ['assets/git-commit/SKILL.md'],
  manifestUrl: 'https://example.com/manifest.json',
  registryName: 'community',
};

const updateResult: InstallResult = {
  asset: mockAsset,
  installedFiles: ['.claude/skills/git-commit/SKILL.md'],
  skippedFiles: [],
  lockfileEntry: { ...installedEntry, version: '2.0.0' },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined): never => {
    throw new Error(`process.exit(${_code})`);
  });
  mockGetRegistries.mockResolvedValue({ assets: [mockAsset], warnings: [] });
  mockUpdateAssetFull.mockResolvedValue(updateResult);
  // Default: no script changes detected
  mockPlanUpdateFull.mockResolvedValue({ plan: {} as never, scriptChanged: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleUpdateCommand — update specific asset with update available', () => {
  it('updates the asset and prints old → new version', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockCheckUpdates.mockReturnValue([
      {
        name: 'git-commit',
        lockfileKey: 'community:skill:git-commit',
        installedVersion: '1.0.0',
        latestVersion: '2.0.0',
      },
    ]);
    const logSpy = vi.spyOn(console, 'log');

    await handleUpdateCommand(['skill', 'git-commit']);

    expect(mockUpdateAssetFull).toHaveBeenCalledWith(
      'community:skill:git-commit',
      '/test/root',
      baseLockfile,
      expect.any(Array),
      undefined,
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Updated skill 'git-commit' (1.0.0 → 2.0.0)"),
    );
  });
});

describe('handleUpdateCommand — update specific asset already up to date', () => {
  it('exits 0 and prints up-to-date message', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockCheckUpdates.mockReturnValue([]); // no updates
    const logSpy = vi.spyOn(console, 'log');

    await expect(handleUpdateCommand(['skill', 'git-commit'])).rejects.toThrow('process.exit(0)');
    expect(mockUpdateAssetFull).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("already up to date"),
    );
  });
});

describe('handleUpdateCommand — update specific asset not installed', () => {
  it('exits 1 with error when asset is not in lockfile', async () => {
    const emptyLockfile: Lockfile = { version: 2, registries: [singleRegistry], installed: {} };
    mockReadLockfile.mockReturnValue(emptyLockfile);
    const errorSpy = vi.spyOn(console, 'error');

    await expect(handleUpdateCommand(['skill', 'git-commit'])).rejects.toThrow('process.exit(1)');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("'git-commit' is not installed"));
  });

  it('exits 1 with error when no lockfile exists', async () => {
    mockReadLockfile.mockReturnValue(null);
    const errorSpy = vi.spyOn(console, 'error');

    await expect(handleUpdateCommand(['skill', 'git-commit'])).rejects.toThrow('process.exit(1)');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("is not installed"));
  });
});

describe('handleUpdateCommand — update all', () => {
  it('updates all assets with available updates and prints per-asset result', async () => {
    const lockfileWithTwo: Lockfile = {
      version: 2,
      registries: [singleRegistry],
      installed: {
        'community:skill:git-commit': installedEntry,
        'community:skill:code-review': { ...installedEntry, type: 'skill' },
      },
    };
    mockReadLockfile.mockReturnValue(lockfileWithTwo);
    mockCheckUpdates.mockReturnValue([
      {
        name: 'git-commit',
        lockfileKey: 'community:skill:git-commit',
        installedVersion: '1.0.0',
        latestVersion: '2.0.0',
      },
      {
        name: 'code-review',
        lockfileKey: 'community:skill:code-review',
        installedVersion: '1.0.0',
        latestVersion: '1.5.0',
      },
    ]);
    const logSpy = vi.spyOn(console, 'log');

    await handleUpdateCommand(['--all']);

    expect(mockUpdateAssetFull).toHaveBeenCalledTimes(2);
    // Should print results for each asset
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('git-commit'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('code-review'));
  });

  it('prints already-up-to-date per-asset line for assets with no update in mixed results', async () => {
    const lockfileWithThree: Lockfile = {
      version: 2,
      registries: [singleRegistry],
      installed: {
        'community:skill:git-commit': installedEntry,          // has update
        'community:skill:code-review': installedEntry,         // already up to date
      },
    };
    mockReadLockfile.mockReturnValue(lockfileWithThree);
    // Only git-commit has an update
    mockCheckUpdates.mockReturnValue([
      {
        name: 'git-commit',
        lockfileKey: 'community:skill:git-commit',
        installedVersion: '1.0.0',
        latestVersion: '2.0.0',
      },
    ]);
    const logSpy = vi.spyOn(console, 'log');

    await handleUpdateCommand(['--all']);

    expect(mockUpdateAssetFull).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('git-commit'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('code-review: already up to date'));
  });

  it('prints all-up-to-date message when no updates are available', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockCheckUpdates.mockReturnValue([]);
    const logSpy = vi.spyOn(console, 'log');

    await expect(handleUpdateCommand(['--all'])).rejects.toThrow('process.exit(0)');
    expect(mockUpdateAssetFull).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('all assets are up to date');
  });
});

// ──────────────────────────────────────────────────────────────────────
// update --all halts on scripted-change asset (task 13.7)
// ──────────────────────────────────────────────────────────────────────

describe('handleUpdateCommand — update all halts when script changed', () => {
  it('exits 1 and names the scripted-change asset when --all encounters a script change', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockCheckUpdates.mockReturnValue([
      {
        name: 'git-commit',
        lockfileKey: 'community:skill:git-commit',
        installedVersion: '1.0.0',
        latestVersion: '2.0.0',
      },
    ]);
    // Simulate planUpdateFull detecting a script change — no files should be written
    mockPlanUpdateFull.mockResolvedValue({ plan: {} as never, scriptChanged: true });

    const errorSpy = vi.spyOn(console, 'error');

    await expect(handleUpdateCommand(['--all'])).rejects.toThrow('process.exit(1)');
    // updateAssetFull must NOT be called — files should not be written before user reviews
    expect(mockUpdateAssetFull).not.toHaveBeenCalled();
    // Error message should name the asset and suggest individual re-run
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('git-commit'),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('script changed'),
    );
  });
});

// ──────────────────────────────────────────────────────────────────────
// update one — script-change disclaimer flow (task 5.7 / WARNING 3)
// ──────────────────────────────────────────────────────────────────────

describe('handleUpdateCommand — update one with script change', () => {
  const scriptedPlanResult = {
    plan: {
      manifest: {
        scripts: { postInstall: 'setup.js' },
        scriptRisks: 'plugins/my-plugin/SCRIPT_RISKS.md',
      },
      scriptRisksContent: 'Run setup.js to configure.',
    },
    scriptChanged: true,
  } as never;

  it('shows disclaimer and prompts when single-asset update has script change', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockCheckUpdates.mockReturnValue([
      { name: 'git-commit', lockfileKey: 'community:skill:git-commit', installedVersion: '1.0.0', latestVersion: '2.0.0' },
    ]);
    mockPlanUpdateFull.mockResolvedValue(scriptedPlanResult);
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    mockCreateInterface.mockReturnValue({
      question: (_prompt: string, cb: (answer: string) => void) => cb('y'),
      close: () => {},
    });

    await handleUpdateCommand(['skill', 'git-commit']);

    const writtenText = stdoutSpy.mock.calls.map((c) => c[0] as string).join('');
    expect(writtenText).toContain('Script changed');
    expect(mockUpdateAssetFull).toHaveBeenCalledWith(
      'community:skill:git-commit',
      expect.any(String),
      baseLockfile,
      expect.any(Array),
      undefined,
      expect.objectContaining({ riskAccepted: true }),
    );
  });

  it('aborts and does not update files when user declines the disclaimer', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockCheckUpdates.mockReturnValue([
      { name: 'git-commit', lockfileKey: 'community:skill:git-commit', installedVersion: '1.0.0', latestVersion: '2.0.0' },
    ]);
    mockPlanUpdateFull.mockResolvedValue(scriptedPlanResult);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    mockCreateInterface.mockReturnValue({
      question: (_prompt: string, cb: (answer: string) => void) => cb('n'),
      close: () => {},
    });
    const errorSpy = vi.spyOn(console, 'error');

    await expect(handleUpdateCommand(['skill', 'git-commit'])).rejects.toThrow('process.exit(1)');
    expect(mockUpdateAssetFull).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('Update aborted.');
  });
});
