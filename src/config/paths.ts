import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export function getCacheDir(): string {
  const base = process.env['XDG_CACHE_HOME'] || path.join(os.homedir(), '.cache');
  return path.join(base, 'ai-stash');
}

export function getProjectRoot(startDir: string = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}
