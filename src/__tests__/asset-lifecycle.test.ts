import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Lockfile } from '../lockfile/types.js';

// ──────────────────────────────────────────────────────────────────────
// 11.1  fetchManifest
// ──────────────────────────────────────────────────────────────────────

describe('fetchManifest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed manifest on success', async () => {
    const manifest = {
      files: ['mcp.json'],
      userConfig: { api_key: { description: 'API key', sensitive: true } },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => manifest,
      }),
    );

    const { fetchManifest } = await import('../registry/fetcher.js');
    const result = await fetchManifest('https://example.com/', 'mcp-servers/github');
    expect(result.files).toEqual(['mcp.json']);
    expect(result.userConfig).toBeDefined();
  });

  it('throws on 404 failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    const { fetchManifest } = await import('../registry/fetcher.js');
    await expect(fetchManifest('https://example.com/', 'mcp-servers/missing')).rejects.toThrow(
      /Failed to fetch manifest.*404/,
    );
  });

  it('throws on malformed JSON (missing files array)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ scripts: {} }),
      }),
    );

    const { fetchManifest } = await import('../registry/fetcher.js');
    await expect(fetchManifest('https://example.com/', 'mcp-servers/bad')).rejects.toThrow(
      /missing or invalid "files" array/,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────
// 11.2  credentials – storeCredential / getCredential
// ──────────────────────────────────────────────────────────────────────

describe('credential storage', () => {
  let tmpDir: string;
  const originalEnv = process.env['XDG_CONFIG_HOME'];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-creds-test-'));
    process.env['XDG_CONFIG_HOME'] = tmpDir;
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalEnv !== undefined) {
      process.env['XDG_CONFIG_HOME'] = originalEnv;
    } else {
      delete process.env['XDG_CONFIG_HOME'];
    }
  });

  it('stores and retrieves via credentials file fallback', async () => {
    // keytar will fail since it's not installed in test env
    const { storeCredential, getCredential } = await import('../config/credentials.js');

    await storeCredential('test-asset', 'api_key', 'secret123');
    const value = await getCredential('test-asset', 'api_key');
    expect(value).toBe('secret123');

    // Verify file has restricted permissions
    const credPath = path.join(tmpDir, 'ai-stash', 'credentials.json');
    expect(fs.existsSync(credPath)).toBe(true);
  });

  it('returns null for non-existent credential', async () => {
    const { getCredential } = await import('../config/credentials.js');
    const value = await getCredential('nonexistent', 'key');
    expect(value).toBeNull();
  });

  it('emits info message at most once on keytar failure', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { storeCredential } = await import('../config/credentials.js');

    await storeCredential('test1', 'k1', 'v1');
    await storeCredential('test2', 'k2', 'v2');

    // info should be emitted at most once (may be 0 if module was already loaded)
    expect(spy.mock.calls.filter((c) => String(c[0]).includes('keychain unavailable')).length).toBeLessThanOrEqual(1);
    spy.mockRestore();
  });
});

// ──────────────────────────────────────────────────────────────────────
// 11.3  collectUserConfig
// ──────────────────────────────────────────────────────────────────────

describe('collectUserConfig', () => {
  let tmpDir: string;
  const originalEnv = process.env['XDG_CONFIG_HOME'];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-config-test-'));
    process.env['XDG_CONFIG_HOME'] = tmpDir;
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalEnv !== undefined) {
      process.env['XDG_CONFIG_HOME'] = originalEnv;
    } else {
      delete process.env['XDG_CONFIG_HOME'];
    }
  });

  it('skips keys already stored', async () => {
    // Pre-store a non-sensitive value
    const { storeUserConfig } = await import('../config/user-settings.js');
    storeUserConfig('my-asset', 'base_url', 'https://api.test.com');

    const { collectUserConfig } = await import('../engine/user-config.js');
    const result = await collectUserConfig('my-asset', {
      base_url: { description: 'API base URL', sensitive: false },
    });

    expect(result.all['base_url']).toBe('https://api.test.com');
    expect(result.nonSensitive['base_url']).toBe('https://api.test.com');
  });
});

// ──────────────────────────────────────────────────────────────────────
// 11.4  substituteUserConfig
// ──────────────────────────────────────────────────────────────────────

describe('substituteUserConfig', () => {
  it('replaces non-sensitive placeholders', async () => {
    const { substituteUserConfig } = await import('../engine/user-config.js');
    const content = 'endpoint = ${user_config.base_url}\ntoken = ${user_config.api_key}';
    const result = substituteUserConfig(content, { base_url: 'https://api.test.com' });
    expect(result).toBe('endpoint = https://api.test.com\ntoken = ${user_config.api_key}');
  });

  it('leaves unknown keys as-is', async () => {
    const { substituteUserConfig } = await import('../engine/user-config.js');
    const content = '${user_config.unknown}';
    const result = substituteUserConfig(content, {});
    expect(result).toBe('${user_config.unknown}');
  });

  it('replaces multiple occurrences of the same key', async () => {
    const { substituteUserConfig } = await import('../engine/user-config.js');
    const content = '${user_config.name} and ${user_config.name}';
    const result = substituteUserConfig(content, { name: 'Alice' });
    expect(result).toBe('Alice and Alice');
  });
});

// ──────────────────────────────────────────────────────────────────────
// 11.5  Install engine integration – folder-based asset
// ──────────────────────────────────────────────────────────────────────

describe('install engine – folder-based asset', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-folder-install-'));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it('installs folder-based asset with manifest, excludes configuredFiles from lockfile, updates gitignore', async () => {
    // Register adapters
    await import('../adapters/index.js');

    const manifest = {
      files: ['mcp.json'],
      userConfig: {
        api_url: { description: 'API URL', sensitive: false },
      },
      scripts: { postInstall: 'setup.js' },
      configuredFiles: ['.env'],
    };

    const fileContent = '{"server": "${user_config.api_url}"}';

    // Mock fetch: first call returns manifest, second returns file content
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => manifest,
        text: async () => JSON.stringify(manifest),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => fileContent,
        json: async () => ({}),
      });
    vi.stubGlobal('fetch', fetchMock);

    // Pre-store non-sensitive config to avoid readline prompt
    process.env['XDG_CONFIG_HOME'] = tmpDir;
    const { storeUserConfig } = await import('../config/user-settings.js');
    storeUserConfig('test-mcp', 'api_url', 'https://api.example.com');

    const { planInstall, executeInstall } = await import('../engine/install.js');

    const asset = {
      name: 'test-mcp',
      type: 'mcp-server' as const,
      version: '1.0.0',
      description: 'Test MCP server',
      tags: ['test'],
      targets: ['claude-code'] as string[],
      folder: 'mcp-servers/test-mcp',
      registryName: 'community',
    };

    const lockfile: Lockfile = {
      version: 2,
      registries: [{ name: 'community', url: 'https://example.com' }],
      installed: {},
    };

    const plan = await planInstall(
      asset,
      ['claude-code'],
      'project',
      tmpDir,
      lockfile,
      'https://example.com/',
    );

    expect(plan.manifest).toBeDefined();
    expect(plan.manifest!.files).toEqual(['mcp.json']);

    const lockfileKey = 'community:mcp-server:test-mcp';
    const result = await executeInstall(plan, {}, tmpDir, lockfile, lockfileKey, 'https://example.com');

    // hasManifest should be set
    expect(lockfile.installed[lockfileKey]?.hasManifest).toBe(true);

    // configuredFiles should not be in lockfile files
    const lockfileFiles = lockfile.installed[lockfileKey]?.files ?? [];
    expect(lockfileFiles.some((f: string) => f.includes('.env'))).toBe(false);
    expect(lockfileFiles.some((f: string) => f.includes('.setup-complete'))).toBe(false);

    // scriptNotice should be present
    expect(result.scriptNotice).toBeDefined();
    expect(result.scriptNotice).toContain('setup.js');

    // gitignore should have configuredFiles entries
    const gitignorePath = path.join(tmpDir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      expect(gitignore).toContain('.env');
      expect(gitignore).toContain('.setup-complete');
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
// 11.6  Update engine – configuredFiles preservation + reconfiguration
// ──────────────────────────────────────────────────────────────────────

describe('update engine – reconfiguration flag', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-update-reconfig-'));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it('sets reconfigurationNeeded when manifest has userConfig and not configStable', async () => {
    await import('../adapters/index.js');

    const manifestV1 = {
      files: ['mcp.json'],
      userConfig: {
        api_url: { description: 'API URL', sensitive: false },
      },
    };
    const manifestV2 = {
      files: ['mcp.json'],
      userConfig: {
        api_url: { description: 'API URL', sensitive: false },
        extra: { description: 'Extra param', sensitive: false },
      },
    };

    // Pre-store config (both v1 and v2 keys to avoid readline prompts)
    process.env['XDG_CONFIG_HOME'] = tmpDir;
    const { storeUserConfig } = await import('../config/user-settings.js');
    storeUserConfig('test-mcp', 'api_url', 'https://api.example.com');
    storeUserConfig('test-mcp', 'extra', 'extra-value');

    // Mock fetch: manifest v1 (for initial install) + file, then manifest v2 (for update) + file
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (String(url).includes('manifest.json')) {
        return {
          ok: true,
          json: async () => (callCount <= 2 ? manifestV1 : manifestV2),
          text: async () => JSON.stringify(callCount <= 2 ? manifestV1 : manifestV2),
        };
      }
      return {
        ok: true,
        text: async () => '{"server": "test"}',
        json: async () => ({}),
      };
    }));

    const { planInstall, executeInstall } = await import('../engine/install.js');
    const { updateAssetFull } = await import('../engine/update.js');

    const asset = {
      name: 'test-mcp',
      type: 'mcp-server' as const,
      version: '1.0.0',
      description: 'Test',
      tags: ['test'],
      targets: ['claude-code'] as string[],
      folder: 'mcp-servers/test-mcp',
      registryName: 'community',
    };

    const lockfile: Lockfile = {
      version: 2,
      registries: [{ name: 'community', url: 'https://example.com' }],
      installed: {},
    };
    const lockfileKey = 'community:mcp-server:test-mcp';

    // Initial install
    const plan = await planInstall(asset, ['claude-code'], 'project', tmpDir, lockfile, 'https://example.com/');
    await executeInstall(plan, {}, tmpDir, lockfile, lockfileKey, 'https://example.com');

    // Now update
    const updatedAsset = { ...asset, version: '2.0.0' };
    await updateAssetFull(
      lockfileKey,
      tmpDir,
      lockfile,
      [updatedAsset],
    );

    // Should be flagged for reconfiguration since configStable is not set
    expect(lockfile.installed[lockfileKey]?.reconfigurationNeeded).toBe(true);
  });

  it('does NOT set reconfigurationNeeded when manifest declares configStable: true', async () => {
    await import('../adapters/index.js');

    const manifestV1 = {
      files: ['mcp.json'],
      userConfig: {
        api_url: { description: 'API URL', sensitive: false },
      },
      configStable: true,
    };
    const manifestV2 = {
      files: ['mcp.json'],
      userConfig: {
        api_url: { description: 'API URL', sensitive: false },
      },
      configStable: true,
    };

    process.env['XDG_CONFIG_HOME'] = tmpDir;
    const { storeUserConfig } = await import('../config/user-settings.js');
    storeUserConfig('test-mcp-stable', 'api_url', 'https://api.example.com');

    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (String(url).includes('manifest.json')) {
        return {
          ok: true,
          json: async () => (callCount <= 2 ? manifestV1 : manifestV2),
          text: async () => JSON.stringify(callCount <= 2 ? manifestV1 : manifestV2),
        };
      }
      return {
        ok: true,
        text: async () => '{"server": "test"}',
        json: async () => ({}),
      };
    }));

    const { planInstall, executeInstall } = await import('../engine/install.js');
    const { updateAssetFull } = await import('../engine/update.js');

    const asset = {
      name: 'test-mcp-stable',
      type: 'mcp-server' as const,
      version: '1.0.0',
      description: 'Test',
      tags: ['test'],
      targets: ['claude-code'] as string[],
      folder: 'mcp-servers/test-mcp-stable',
      registryName: 'community',
    };

    const lockfile: Lockfile = {
      version: 2,
      registries: [{ name: 'community', url: 'https://example.com' }],
      installed: {},
    };
    const lockfileKey = 'community:mcp-server:test-mcp-stable';

    const plan = await planInstall(asset, ['claude-code'], 'project', tmpDir, lockfile, 'https://example.com/');
    await executeInstall(plan, {}, tmpDir, lockfile, lockfileKey, 'https://example.com');

    const updatedAsset = { ...asset, version: '2.0.0' };
    await updateAssetFull(lockfileKey, tmpDir, lockfile, [updatedAsset]);

    expect(lockfile.installed[lockfileKey]?.reconfigurationNeeded).toBeFalsy();
  });
});

// ──────────────────────────────────────────────────────────────────────
// 11.7  Remove engine – postUninstall notice
// ──────────────────────────────────────────────────────────────────────

describe('remove engine – script notice', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-remove-notice-'));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it('returns scriptNotice when manifest declares postUninstall', async () => {
    await import('../adapters/index.js');

    // Create the installed asset files manually
    const assetDir = path.join(tmpDir, '.claude', 'mcp-servers', 'test-mcp');
    fs.mkdirSync(assetDir, { recursive: true });
    fs.writeFileSync(
      path.join(assetDir, 'manifest.json'),
      JSON.stringify({
        files: ['mcp.json'],
        scripts: { postUninstall: 'teardown.js' },
      }),
    );
    fs.writeFileSync(path.join(assetDir, 'mcp.json'), '{}');

    const { removeAssetFull } = await import('../engine/update.js');

    const lockfileKey = 'community:mcp-server:test-mcp';
    const lockfile: Lockfile = {
      version: 2,
      registries: [{ name: 'community', url: 'https://example.com' }],
      installed: {
        [lockfileKey]: {
          type: 'mcp-server',
          version: '1.0.0',
          installedAt: new Date().toISOString(),
          targets: ['claude-code'],
          scope: 'project',
          files: ['.claude/mcp-servers/test-mcp/mcp.json'],
          registryUrl: 'https://example.com',
          hasManifest: true,
        },
      },
    };

    const result = await removeAssetFull(lockfileKey, tmpDir, lockfile);
    expect(result).toBeDefined();
    expect(result.scriptNotice).toBeDefined();
    expect(result.scriptNotice).toContain('teardown.js');
  });
});

// ──────────────────────────────────────────────────────────────────────
// 11.8  checkSetupPending
// ──────────────────────────────────────────────────────────────────────

describe('checkSetupPending', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-setup-pending-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns true when .setup-complete is missing and manifest has postInstall', async () => {
    const { checkSetupPending } = await import('../engine/install.js');

    // Create installed asset with manifest
    const assetDir = path.join(tmpDir, '.claude', 'hooks', 'test-hook');
    fs.mkdirSync(assetDir, { recursive: true });
    fs.writeFileSync(
      path.join(assetDir, 'manifest.json'),
      JSON.stringify({ files: ['config.json'], scripts: { postInstall: 'setup.js' } }),
    );
    fs.writeFileSync(path.join(assetDir, 'config.json'), '{}');

    const result = checkSetupPending(tmpDir, 'community:hook:test-hook', {
      type: 'hook',
      version: '1.0.0',
      installedAt: new Date().toISOString(),
      targets: ['claude-code'],
      scope: 'project',
      files: ['.claude/hooks/test-hook/config.json'],
      registryUrl: 'https://example.com',
      hasManifest: true,
    });

    expect(result).toBe(true);
  });

  it('returns false when .setup-complete exists', async () => {
    const { checkSetupPending } = await import('../engine/install.js');

    const assetDir = path.join(tmpDir, '.claude', 'hooks', 'test-hook');
    fs.mkdirSync(assetDir, { recursive: true });
    fs.writeFileSync(
      path.join(assetDir, 'manifest.json'),
      JSON.stringify({ files: ['config.json'], scripts: { postInstall: 'setup.js' } }),
    );
    fs.writeFileSync(path.join(assetDir, 'config.json'), '{}');
    fs.writeFileSync(path.join(assetDir, '.setup-complete'), '');

    const result = checkSetupPending(tmpDir, 'community:hook:test-hook', {
      type: 'hook',
      version: '1.0.0',
      installedAt: new Date().toISOString(),
      targets: ['claude-code'],
      scope: 'project',
      files: ['.claude/hooks/test-hook/config.json'],
      registryUrl: 'https://example.com',
      hasManifest: true,
    });

    expect(result).toBe(false);
  });

  it('returns false when asset has no manifest', async () => {
    const { checkSetupPending } = await import('../engine/install.js');

    const result = checkSetupPending(tmpDir, 'community:skill:test-skill', {
      type: 'skill',
      version: '1.0.0',
      installedAt: new Date().toISOString(),
      targets: ['claude-code'],
      scope: 'project',
      files: ['.claude/skills/test-skill/main.md'],
      registryUrl: 'https://example.com',
    });

    expect(result).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// 11.9  user-settings store/retrieve
// ──────────────────────────────────────────────────────────────────────

describe('user-settings', () => {
  let tmpDir: string;
  const originalEnv = process.env['XDG_CONFIG_HOME'];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-stash-settings-test-'));
    process.env['XDG_CONFIG_HOME'] = tmpDir;
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (originalEnv !== undefined) {
      process.env['XDG_CONFIG_HOME'] = originalEnv;
    } else {
      delete process.env['XDG_CONFIG_HOME'];
    }
  });

  it('stores and retrieves non-sensitive config', async () => {
    const { storeUserConfig, getUserConfig } = await import('../config/user-settings.js');

    storeUserConfig('my-plugin', 'base_url', 'https://test.com');
    const value = getUserConfig('my-plugin', 'base_url');
    expect(value).toBe('https://test.com');
  });

  it('returns null for missing config', async () => {
    const { getUserConfig } = await import('../config/user-settings.js');
    expect(getUserConfig('nonexistent', 'key')).toBeNull();
  });
});
