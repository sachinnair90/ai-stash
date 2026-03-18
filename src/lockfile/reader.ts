import fs from 'node:fs';
import path from 'node:path';
import type { Lockfile } from './types.js';

export function readLockfile(projectRoot: string): Lockfile | null {
  const lockfilePath = path.join(projectRoot, 'ai-stash.lock.json');

  if (!fs.existsSync(lockfilePath)) {
    return null;
  }

  const raw = fs.readFileSync(lockfilePath, 'utf-8');
  let lockfile: Lockfile;
  try {
    lockfile = JSON.parse(raw) as Lockfile;
  } catch {
    console.warn('ai-stash: lockfile is corrupted or invalid JSON, ignoring');
    return null;
  }

  // Migrate legacy 'prompt' type to 'command'
  for (const asset of Object.values(lockfile.installed)) {
    if (asset.type === 'prompt') asset.type = 'command';
  }

  return lockfile;
}
