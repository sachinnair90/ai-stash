#!/usr/bin/env node
/**
 * Git Hook: post-commit
 *
 * Clears the AI session state after a commit that included AI attribution
 * trailers, so the next session starts clean without stale entries.
 *
 * Only acts when prepare-commit-msg signalled that it injected attribution
 * (indicated by the presence of .git/.ai_commit_pending).
 */

import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Chain to any pre-existing hook that was backed up during installation
const _backupHook = fileURLToPath(import.meta.url) + '.pre-ai';
if (existsSync(_backupHook)) {
  const _r = spawnSync(_backupHook, process.argv.slice(2), { stdio: 'inherit' });
  if ((_r.status ?? 0) !== 0) process.exit(_r.status ?? 1);
}

let gitDir;
try {
  gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf8' }).trim();
} catch {
  process.exit(0);
}

const sessionFile = resolve(gitDir, '.ai_session_files');
const metaFile    = resolve(gitDir, '.ai_session_meta');
const pendingFlag = resolve(gitDir, '.ai_commit_pending');

if (existsSync(pendingFlag)) {
  // Clean up ALL session state so the next non-AI commit is not falsely attributed.
  // If the AI assistant is still active, track-ai-edits will re-create the meta
  // and session files on the next edit — so no attribution is lost.
  for (const f of [sessionFile, metaFile, pendingFlag]) {
    try { if (existsSync(f)) rmSync(f); } catch { /* ignore */ }
  }
}

process.exit(0);
