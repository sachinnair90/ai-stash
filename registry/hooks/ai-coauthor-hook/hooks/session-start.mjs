#!/usr/bin/env node
/**
 * Copilot Hook: session-start
 * Event: sessionStart (GitHub Copilot coding agent)
 *
 * Installs git hooks for AI attribution into .git/hooks/ so that commits
 * created during this Copilot coding agent session are tagged with
 * Co-authored-by and AI-modified: trailers.
 *
 * This is necessary because the Copilot coding agent checks out the repository
 * fresh on every run — git hooks in .git/hooks/ are not persisted. This hook
 * installs them from the committed scripts in .github/hooks/git/.
 *
 * It also writes .git/.ai_session_meta so the prepare-commit-msg hook can
 * identify the assistant even without environment variables.
 */

import {
  copyFileSync,
  chmodSync,
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Consume stdin (required by Copilot hook protocol)
try { readFileSync(0, 'utf8'); } catch { /* ignore */ }

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

let gitDir;
try {
  gitDir = execSync('git rev-parse --git-dir', { encoding: 'utf8' }).trim();
} catch {
  process.exit(0);
}

// ── Install git hooks from .github/hooks/git/ ─────────────────────────────────
const gitHooksDir = resolve(gitDir, 'hooks');
if (!existsSync(gitHooksDir)) mkdirSync(gitHooksDir, { recursive: true });

// The committed git hook scripts live alongside this file in .github/hooks/git/
const gitScriptsDir = resolve(__dirname, 'git');

for (const hook of ['prepare-commit-msg', 'post-commit']) {
  const src  = resolve(gitScriptsDir, `${hook}.mjs`);
  const dest = resolve(gitHooksDir, hook);

  if (!existsSync(src)) continue;

  // Reinstall whenever source has changed; back up non-AI hooks only once
  if (existsSync(dest)) {
    const existing   = readFileSync(dest, 'utf8');
    const srcContent = readFileSync(src,  'utf8');
    if (existing === srcContent) continue; // already up to date
    if (!existing.includes('ai_session_files')) {
      copyFileSync(dest, `${dest}.pre-ai`); // backup non-AI hook
    }
  }

  copyFileSync(src, dest);
  try { chmodSync(dest, 0o755); } catch { /* Windows: chmod is a no-op */ }
}

// ── Write Copilot session metadata ────────────────────────────────────────────
const metaFile = resolve(gitDir, '.ai_session_meta');
if (!existsSync(metaFile)) {
  writeFileSync(
    metaFile,
    'ASSISTANT=copilot\nDISPLAY_NAME=GitHub Copilot\nEMAIL=github-copilot[bot]@users.noreply.github.com\n'
  );
}

process.exit(0);
