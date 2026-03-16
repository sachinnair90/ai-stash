import fs from 'node:fs';
import path from 'node:path';
import type { Lockfile } from './types.js';

export function writeLockfile(projectRoot: string, lockfile: Lockfile): void {
  const lockfilePath = path.join(projectRoot, 'ai-stash.lock.json');
  fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2) + '\n', 'utf-8');
}
