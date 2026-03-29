import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Lockfile, RegistryConfig, InstalledAsset } from './types.js';

function deriveRegistryName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // e.g. "raw.githubusercontent.com" -> "raw-githubusercontent"
    return hostname.replace(/\./g, '-');
  } catch {
    return 'registry';
  }
}

interface LockfileV1 {
  version: 1;
  registry: string;
  installed: Record<string, {
    type: string;
    version: string;
    installedAt: string;
    targets: string[];
    scope: string;
    files: string[];
  }>;
}

function migrateV1ToV2(v1: LockfileV1, lockfilePath: string): Lockfile {
  // Write backup
  const backupPath = lockfilePath + '.v1.bak';
  fs.writeFileSync(backupPath, JSON.stringify(v1, null, 2) + '\n', 'utf-8');

  const registryUrl = v1.registry;
  const registryName = deriveRegistryName(registryUrl);
  const registries: RegistryConfig[] = [{ name: registryName, url: registryUrl }];

  const installed: Record<string, InstalledAsset> = {};
  for (const [oldKey, asset] of Object.entries(v1.installed)) {
    const type = asset.type === 'prompt' ? 'command' : asset.type;
    const newKey = `${registryName}:${type}:${oldKey}`;
    installed[newKey] = {
      type,
      version: asset.version,
      installedAt: asset.installedAt,
      targets: asset.targets,
      scope: asset.scope,
      files: asset.files,
      registryUrl,
    };
  }

  const v2: Lockfile = { version: 2, registries, installed };
  fs.writeFileSync(lockfilePath, JSON.stringify(v2, null, 2) + '\n', 'utf-8');
  return v2;
}

export function readLockfile(projectRoot: string): Lockfile | null {
  const lockfilePath = path.join(projectRoot, 'ai-stash.lock.json');

  if (!fs.existsSync(lockfilePath)) {
    return null;
  }

  const raw = fs.readFileSync(lockfilePath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('ai-stash: lockfile is corrupted or invalid JSON, ignoring');
    return null;
  }

  const data = parsed as Record<string, unknown>;

  // v1 migration
  if (data['version'] === 1) {
    return migrateV1ToV2(data as unknown as LockfileV1, lockfilePath);
  }

  const lockfile = parsed as Lockfile;

  // Migrate legacy 'prompt' type to 'command'
  for (const asset of Object.values(lockfile.installed)) {
    if (asset.type === 'prompt') asset.type = 'command';
  }

  return lockfile;
}
