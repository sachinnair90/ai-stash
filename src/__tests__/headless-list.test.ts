import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Lockfile } from '../lockfile/types.js';

vi.mock('../lockfile/index.js', () => ({
  readLockfile: vi.fn(),
  writeLockfile: vi.fn(),
}));

vi.mock('../config/paths.js', () => ({
  getProjectRoot: vi.fn().mockReturnValue('/test/root'),
}));

vi.mock('../engine/install.js', () => ({
  checkSetupPending: vi.fn().mockReturnValue(false),
}));

import { readLockfile } from '../lockfile/index.js';
import { handleListCommand } from '../commands/list.js';
import { checkSetupPending } from '../engine/install.js';

const mockReadLockfile = vi.mocked(readLockfile);
const mockCheckSetupPending = vi.mocked(checkSetupPending);

const singleRegistry = { name: 'community', url: 'https://example.com/registry.json' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null | undefined): never => {
    throw new Error(`process.exit(${_code})`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleListCommand — with installed assets', () => {
  it('prints a table with TYPE, NAME, VERSION, SCOPE, REGISTRY columns', () => {
    const lockfile: Lockfile = {
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
        'community:agent:debug-agent': {
          type: 'agent',
          version: '2.1.0',
          installedAt: '2026-01-02T00:00:00Z',
          targets: ['claude-code'],
          scope: 'global',
          files: ['.claude/agents/debug-agent.md'],
          registryUrl: singleRegistry.url,
        },
      },
    };
    mockReadLockfile.mockReturnValue(lockfile);
    const logSpy = vi.spyOn(console, 'log');

    handleListCommand([]);

    const calls = logSpy.mock.calls.map((c) => c[0] as string);
    // Header row
    expect(calls[0]).toMatch(/TYPE/);
    expect(calls[0]).toMatch(/NAME/);
    expect(calls[0]).toMatch(/VERSION/);
    expect(calls[0]).toMatch(/SCOPE/);
    expect(calls[0]).toMatch(/REGISTRY/);
    // Data rows
    expect(calls.some((c) => c.includes('git-commit'))).toBe(true);
    expect(calls.some((c) => c.includes('debug-agent'))).toBe(true);
    expect(calls.some((c) => c.includes('1.0.0'))).toBe(true);
    expect(calls.some((c) => c.includes('community'))).toBe(true);
  });
});

describe('handleListCommand — empty lockfile', () => {
  it('prints no-assets message and exits 0 when lockfile has no entries', () => {
    const emptyLockfile: Lockfile = { version: 2, registries: [singleRegistry], installed: {} };
    mockReadLockfile.mockReturnValue(emptyLockfile);
    const logSpy = vi.spyOn(console, 'log');

    expect(() => handleListCommand([])).toThrow('process.exit(0)');
    expect(logSpy).toHaveBeenCalledWith('no assets installed');
  });
});

describe('handleListCommand — no lockfile', () => {
  it('prints no-assets message and exits 0 when no lockfile exists', () => {
    mockReadLockfile.mockReturnValue(null);
    const logSpy = vi.spyOn(console, 'log');

    expect(() => handleListCommand([])).toThrow('process.exit(0)');
    expect(logSpy).toHaveBeenCalledWith('no assets installed');
  });
});

describe('handleListCommand — setup pending indicator', () => {
  it('shows "setup pending" when checkSetupPending returns true', () => {
    mockCheckSetupPending.mockReturnValue(true);
    const lockfile: Lockfile = {
      version: 2,
      registries: [singleRegistry],
      installed: {
        'community:hook:my-hook': {
          type: 'hook',
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/hooks/my-hook/hook-config.json'],
          registryUrl: singleRegistry.url,
          hasManifest: true,
        },
      },
    };
    mockReadLockfile.mockReturnValue(lockfile);
    const logSpy = vi.spyOn(console, 'log');

    handleListCommand([]);

    const rows = logSpy.mock.calls.map((c) => c[0] as string);
    expect(rows.some((r) => r.includes('setup pending'))).toBe(true);
    mockCheckSetupPending.mockReturnValue(false);
  });
});

describe('handleListCommand — reconfiguration needed indicator', () => {
  it('shows "reconfiguration needed" when asset has reconfigurationNeeded flag', () => {
    mockCheckSetupPending.mockReturnValue(false);
    const lockfile: Lockfile = {
      version: 2,
      registries: [singleRegistry],
      installed: {
        'community:mcp-server:github': {
          type: 'mcp-server',
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/mcp-servers/github/mcp.json'],
          registryUrl: singleRegistry.url,
          hasManifest: true,
          reconfigurationNeeded: true,
        },
      },
    };
    mockReadLockfile.mockReturnValue(lockfile);
    const logSpy = vi.spyOn(console, 'log');

    handleListCommand([]);

    const rows = logSpy.mock.calls.map((c) => c[0] as string);
    expect(rows.some((r) => r.includes('reconfiguration needed'))).toBe(true);
  });
});
