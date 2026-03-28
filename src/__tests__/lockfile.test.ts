import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  readLockfile,
  writeLockfile,
  isInstalled,
  getInstalledVersion,
  isUpdateAvailable,
} from '../lockfile/index.js';
import type { Lockfile } from '../lockfile/types.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-lockfile-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const sampleLockfile: Lockfile = {
  version: 2,
  registries: [{ name: 'community', url: 'https://example.com/registry.json' }],
  installed: {
    'community:skill:my-asset': {
      type: 'skill',
      version: '1.0.0',
      installedAt: '2026-01-01T00:00:00Z',
      targets: ['claude-code'],
      scope: 'project',
      files: ['.claude/skills/my-asset/main.md'],
      registryUrl: 'https://example.com/registry.json',
    },
  },
};

describe('readLockfile', () => {
  it('returns null when file is missing', () => {
    const result = readLockfile(tmpDir);
    expect(result).toBeNull();
  });

  it('parses valid v2 lockfile correctly', () => {
    const lockfilePath = path.join(tmpDir, 'ai-stash.lock.json');
    fs.writeFileSync(lockfilePath, JSON.stringify(sampleLockfile, null, 2), 'utf-8');

    const result = readLockfile(tmpDir);
    expect(result).toEqual(sampleLockfile);
    expect(result!.version).toBe(2);
    expect(result!.registries[0].name).toBe('community');
    expect(result!.installed['community:skill:my-asset'].version).toBe('1.0.0');
  });

  it('migrates v1 lockfile to v2 on read', () => {
    const v1Lockfile = {
      version: 1,
      registry: 'https://example.com/registry.json',
      installed: {
        'my-asset': {
          type: 'skill',
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/skills/my-asset/main.md'],
        },
      },
    };

    const lockfilePath = path.join(tmpDir, 'ai-stash.lock.json');
    fs.writeFileSync(lockfilePath, JSON.stringify(v1Lockfile, null, 2), 'utf-8');

    const result = readLockfile(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(2);
    expect(result!.registries).toHaveLength(1);
    expect(result!.registries[0].url).toBe('https://example.com/registry.json');

    // Key must be rekeyed to registry:type:name
    const keys = Object.keys(result!.installed);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^[\w-]+:skill:my-asset$/);

    // registryUrl backfilled
    expect(Object.values(result!.installed)[0].registryUrl).toBe('https://example.com/registry.json');
  });

  it('writes v1.bak backup during migration', () => {
    const v1Lockfile = {
      version: 1,
      registry: 'https://example.com/registry.json',
      installed: {},
    };
    const lockfilePath = path.join(tmpDir, 'ai-stash.lock.json');
    fs.writeFileSync(lockfilePath, JSON.stringify(v1Lockfile, null, 2), 'utf-8');

    readLockfile(tmpDir);

    const backupPath = lockfilePath + '.v1.bak';
    expect(fs.existsSync(backupPath)).toBe(true);
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    expect(backup.version).toBe(1);
  });

  it('coerces legacy type "prompt" to "command" at read time', () => {
    const lockfileWithPrompt: Lockfile = {
      version: 2,
      registries: [{ name: 'test', url: 'https://example.com/registry.json' }],
      installed: {
        'test:command:my-prompt': {
          type: 'prompt',
          version: '1.0.0',
          installedAt: '2026-01-01T00:00:00Z',
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/commands/my-prompt.md'],
          registryUrl: 'https://example.com/registry.json',
        },
      },
    };

    const lockfilePath = path.join(tmpDir, 'ai-stash.lock.json');
    fs.writeFileSync(lockfilePath, JSON.stringify(lockfileWithPrompt, null, 2), 'utf-8');

    const result = readLockfile(tmpDir);
    expect(result!.installed['test:command:my-prompt'].type).toBe('command');
  });
});

describe('writeLockfile', () => {
  it('creates file with correct content', () => {
    writeLockfile(tmpDir, sampleLockfile);

    const lockfilePath = path.join(tmpDir, 'ai-stash.lock.json');
    expect(fs.existsSync(lockfilePath)).toBe(true);

    const content = fs.readFileSync(lockfilePath, 'utf-8');
    const parsed = JSON.parse(content) as Lockfile;
    expect(parsed).toEqual(sampleLockfile);
  });
});

describe('isInstalled', () => {
  it('returns true for installed asset by lockfile key', () => {
    expect(isInstalled(sampleLockfile, 'community:skill:my-asset')).toBe(true);
  });

  it('returns true for installed asset by bare name', () => {
    expect(isInstalled(sampleLockfile, 'my-asset')).toBe(true);
  });

  it('returns false for missing asset', () => {
    expect(isInstalled(sampleLockfile, 'nonexistent')).toBe(false);
  });

  it('returns false when lockfile is null', () => {
    expect(isInstalled(null, 'my-asset')).toBe(false);
  });
});

describe('getInstalledVersion', () => {
  it('returns correct version by lockfile key', () => {
    expect(getInstalledVersion(sampleLockfile, 'community:skill:my-asset')).toBe('1.0.0');
  });

  it('returns correct version by bare name', () => {
    expect(getInstalledVersion(sampleLockfile, 'my-asset')).toBe('1.0.0');
  });

  it('returns null for missing asset', () => {
    expect(getInstalledVersion(sampleLockfile, 'nonexistent')).toBeNull();
  });

  it('returns null when lockfile is null', () => {
    expect(getInstalledVersion(null, 'my-asset')).toBeNull();
  });
});

describe('isUpdateAvailable', () => {
  it('detects version mismatch', () => {
    expect(isUpdateAvailable(sampleLockfile, 'community:skill:my-asset', '2.0.0')).toBe(true);
  });

  it('returns false when versions match', () => {
    expect(isUpdateAvailable(sampleLockfile, 'community:skill:my-asset', '1.0.0')).toBe(false);
  });

  it('returns false for uninstalled asset', () => {
    expect(isUpdateAvailable(sampleLockfile, 'nonexistent', '1.0.0')).toBe(false);
  });
});
