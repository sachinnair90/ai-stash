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

describe('readLockfile', () => {
  it('returns null when file is missing', () => {
    const result = readLockfile(tmpDir);
    expect(result).toBeNull();
  });

  it('parses valid lockfile correctly', () => {
    const lockfilePath = path.join(tmpDir, 'ai-stash.lock.json');
    fs.writeFileSync(lockfilePath, JSON.stringify(sampleLockfile, null, 2), 'utf-8');

    const result = readLockfile(tmpDir);
    expect(result).toEqual(sampleLockfile);
    expect(result!.version).toBe(1);
    expect(result!.installed['my-asset'].version).toBe('1.0.0');
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
  it('returns true for installed asset', () => {
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
  it('returns correct version for installed asset', () => {
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
    expect(isUpdateAvailable(sampleLockfile, 'my-asset', '2.0.0')).toBe(true);
  });

  it('returns false when versions match', () => {
    expect(isUpdateAvailable(sampleLockfile, 'my-asset', '1.0.0')).toBe(false);
  });

  it('returns false for uninstalled asset', () => {
    expect(isUpdateAvailable(sampleLockfile, 'nonexistent', '1.0.0')).toBe(false);
  });
});
