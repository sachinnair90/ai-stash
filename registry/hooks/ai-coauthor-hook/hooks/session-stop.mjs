#!/usr/bin/env node
/**
 * AI Hook: session-stop
 * Event: Stop (Claude Code) / sessionEnd (GitHub Copilot coding agent)
 *
 * Prints a summary of AI-touched files so the developer can review before
 * committing. Reads the assistant name from .git/.ai_session_meta when
 * available.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

// Consume stdin (required by Copilot hook protocol; Claude Code sends nothing)
try { readFileSync(0, 'utf8'); } catch { /* no stdin is fine */ }

function getGitRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const gitRoot = getGitRoot();
if (!gitRoot) process.exit(0);

const sessionFile = resolve(gitRoot, '.git/.ai_session_files');
const metaFile    = resolve(gitRoot, '.git/.ai_session_meta');

if (!existsSync(sessionFile)) process.exit(0);
const content = readFileSync(sessionFile, 'utf8').trim();
if (!content) process.exit(0);

let displayName = 'AI Assistant';
if (existsSync(metaFile)) {
  const match = readFileSync(metaFile, 'utf8').match(/^DISPLAY_NAME=(.+)$/m);
  if (match) displayName = match[1].trim();
}

const uniqueFiles = [
  ...new Set(
    content.split('\n')
      .filter(Boolean)
      .map(l => l.split('\t')[1])
      .filter(Boolean)
  ),
];

const count = uniqueFiles.length;
console.log('');
console.log('+-----------------------------------------------------------+');
console.log(`|  AI co-authored ${count} file(s) this session`);
console.log(`|  Assistant: ${displayName}`);
console.log('|');
for (const f of uniqueFiles) {
  console.log(`|    - ${f}`);
}
console.log('|');
console.log(`|  Your next 'git commit' will include:`);
console.log(`|    Co-authored-by: ${displayName}`);
console.log('+-----------------------------------------------------------+');
console.log('');

process.exit(0);
