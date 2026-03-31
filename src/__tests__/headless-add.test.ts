import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Lockfile } from '../lockfile/types.js';
import type { RegistryAsset } from '../registry/types.js';
import type { InstallResult, InstallPlan } from '../engine/types.js';

vi.mock('../lockfile/index.js', () => ({
  readLockfile: vi.fn(),
  writeLockfile: vi.fn(),
  getUnsyncedAssets: vi.fn(),
}));

vi.mock('../engine/install.js', () => ({
  planInstall: vi.fn(),
  executeInstall: vi.fn(),
  resolveForInstall: vi.fn(),
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
import { planInstall, executeInstall, resolveForInstall } from '../engine/install.js';
import { getRegistries } from '../registry/client.js';
import { handleAddCommand } from '../commands/add.js';

const mockReadLockfile = vi.mocked(readLockfile);
const mockPlanInstall = vi.mocked(planInstall);
const mockExecuteInstall = vi.mocked(executeInstall);
const mockResolveForInstall = vi.mocked(resolveForInstall);

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
  file: 'assets/git-commit/SKILL.md',
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

/** Minimal plan returned by the mock — no scripts, so no disclaimer gate. */
const basePlan: InstallPlan = {
  asset: mockAsset,
  targets: ['claude-code'],
  scope: 'project',
  files: { '.claude/skills/git-commit/SKILL.md': '# skill' },
  conflicts: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined): never => {
    throw new Error(`process.exit(${_code})`);
  });
  mockGetRegistries.mockResolvedValue({ assets: [mockAsset], warnings: [] });
  mockResolveForInstall.mockReturnValue({
    resolvedAsset: mockAsset,
    lockfileKey: 'community:skill:git-commit',
    suffixApplied: false,
    conflictingRegistry: null,
  });
  mockPlanInstall.mockResolvedValue(basePlan);
  mockExecuteInstall.mockResolvedValue(installResult);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleAddCommand — add from single registry', () => {
  it('installs the asset and prints confirmation', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    const logSpy = vi.spyOn(console, 'log');

    await handleAddCommand(['skill', 'git-commit']);

    expect(mockExecuteInstall).toHaveBeenCalled();
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
    expect(mockExecuteInstall).not.toHaveBeenCalled();
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
    expect(mockExecuteInstall).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("already installed (0.9.0), use 'update' to upgrade");
  });
});

describe('handleAddCommand — no registries configured', () => {
  it('exits 1 and prints guidance when no registries are configured', async () => {
    mockReadLockfile.mockReturnValue({ version: 2, registries: [], installed: {} });
    const errorSpy = vi.spyOn(console, 'error');

    await expect(handleAddCommand(['skill', 'git-commit'])).rejects.toThrow('process.exit(1)');
    expect(mockExecuteInstall).not.toHaveBeenCalled();
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
    expect(mockExecuteInstall).not.toHaveBeenCalled();
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

    // planInstall should be called with 'global' scope
    expect(mockPlanInstall).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array),
      'global',
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

    // planInstall should be called with the specified targets
    expect(mockPlanInstall).toHaveBeenCalledWith(
      expect.any(Object),
      ['claude-code'],
      expect.any(String),
      expect.any(String),
      expect.any(Object),
      expect.any(String),
      undefined,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────
// Script disclaimer tests (tasks 12.2 / 13.2)
// ──────────────────────────────────────────────────────────────────────

import { GENERIC_SCRIPT_RISKS } from '../engine/script-risks.js';

/** Plan with a postInstall script declared. */
const scriptedPlan: InstallPlan = {
  ...basePlan,
  manifest: {
    files: ['setup.js'],
    scripts: { postInstall: 'setup.js' },
  },
  scriptRisksContent: 'Author docs: run setup.js',
};

describe('handleAddCommand — scripted asset disclaimer', () => {
  it('shows disclaimer and prompts when asset has scripts', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockPlanInstall.mockResolvedValue(scriptedPlan);

    // Simulate user typing 'y' to accept
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    mockCreateInterface.mockReturnValue({
      question: (_prompt: string, cb: (answer: string) => void) => cb('y'),
      close: () => {},
    });

    await handleAddCommand(['skill', 'git-commit']);

    // Disclaimer text contains GENERIC_SCRIPT_RISKS content
    const writtenText = stdoutSpy.mock.calls.map((c) => c[0] as string).join('');
    expect(writtenText).toContain(GENERIC_SCRIPT_RISKS.slice(0, 30));
    expect(mockExecuteInstall).toHaveBeenCalled();
  });

  it('aborts with exit 1 when user declines the disclaimer', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockPlanInstall.mockResolvedValue(scriptedPlan);

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    mockCreateInterface.mockReturnValue({
      question: (_prompt: string, cb: (answer: string) => void) => cb('n'),
      close: () => {},
    });
    const errorSpy = vi.spyOn(console, 'error');

    await expect(handleAddCommand(['skill', 'git-commit'])).rejects.toThrow('process.exit(1)');
    expect(mockExecuteInstall).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('Installation aborted.');
  });

  it('bypasses prompt and installs when --accept-script-risks flag is present', async () => {
    mockReadLockfile.mockReturnValue(baseLockfile);
    mockPlanInstall.mockResolvedValue(scriptedPlan);

    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await handleAddCommand(['skill', 'git-commit', '--accept-script-risks']);

    // readline should not have been called — no interactive prompt
    expect(mockCreateInterface).not.toHaveBeenCalled();
    expect(mockExecuteInstall).toHaveBeenCalled();
    // riskAccepted should be true in the options passed to executeInstall
    const callArgs = mockExecuteInstall.mock.calls[0];
    expect(callArgs[6]).toMatchObject({ riskAccepted: true });
  });
});

// ──────────────────────────────────────────────────────────────────────
// buildScriptDisclaimerText — GENERIC_SCRIPT_RISKS appears first (task 13.8)
// ──────────────────────────────────────────────────────────────────────

import { buildScriptDisclaimerText } from '../engine/script-risks.js';

describe('buildScriptDisclaimerText', () => {
  it('places GENERIC_SCRIPT_RISKS before any author content', () => {
    const text = buildScriptDisclaimerText(
      'my-plugin',
      ['postInstall: setup.js'],
      '## Author Docs\nThis is what the script does.',
      true,  // hasDeclaredScriptRisks
      true,  // hasPostInstall
      false,
    );

    const genericPos = text.indexOf(GENERIC_SCRIPT_RISKS.slice(0, 30));
    const authorPos = text.indexOf('Author Docs');
    expect(genericPos).toBeGreaterThanOrEqual(0);
    expect(authorPos).toBeGreaterThan(genericPos);
  });

  it('includes generic risks even when author docs are unavailable (null)', () => {
    const text = buildScriptDisclaimerText(
      'my-plugin',
      ['postInstall: setup.js'],
      undefined,
      true,  // hasDeclaredScriptRisks — declared but fetch failed
      true,  // hasPostInstall
      false,
    );

    expect(text).toContain(GENERIC_SCRIPT_RISKS.slice(0, 30));
    expect(text).toContain('unavailable');
  });

  it('adds no-cleanup warning when postInstall declared without postUninstall', () => {
    const text = buildScriptDisclaimerText(
      'my-plugin',
      ['postInstall: setup.js'],
      undefined,
      false,  // hasDeclaredScriptRisks
      true,   // hasPostInstall
      false,
    );

    expect(text).toContain('No cleanup script');
  });

  it('omits no-cleanup warning when postUninstall is present', () => {
    const text = buildScriptDisclaimerText(
      'my-plugin',
      ['postInstall: setup.js', 'postUninstall: teardown.js'],
      undefined,
      false,  // hasDeclaredScriptRisks
      true,   // hasPostInstall
      true,
    );

    expect(text).not.toContain('No cleanup script');
  });
});
