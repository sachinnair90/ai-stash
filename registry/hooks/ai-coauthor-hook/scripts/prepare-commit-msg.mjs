#!/usr/bin/env node
/**
 * Git Hook: prepare-commit-msg
 *
 * Appends AI attribution trailers when staged files contain AI contributions.
 *
 * Supported assistants:
 *   Claude Code      — tracked via .git/.ai_session_files (written by track-ai-edits.mjs)
 *   GitHub Copilot   — detected via GITHUB_COPILOT_AGENT / COPILOT_AGENT_ID / GITHUB_ACTOR
 *                      env vars, or AI_ASSISTANT=copilot, or .git/.ai_session_files
 *   Any AI tool      — tracked via .git/.ai_session_files with optional .ai_session_meta
 *
 * Trailers appended to the commit message:
 *   Co-authored-by: GitHub Copilot <github-copilot[bot]@users.noreply.github.com>
 *   AI-modified: src/auth/login.ts
 *
 * These are real git trailers (not comments) — queryable across history:
 *   git log --grep="AI-modified: src/auth"
 *
 * Environment overrides:
 *   AI_SIMILARITY_THRESHOLD   Minimum % of AI lines that must remain (default: 70)
 *   AI_ASSISTANT              Set to "copilot" to force Copilot attribution
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Chain to any pre-existing hook that was backed up during installation
const _backupHook = fileURLToPath(import.meta.url) + '.pre-ai';
if (existsSync(_backupHook)) {
  const _r = spawnSync(_backupHook, process.argv.slice(2), { stdio: 'inherit' });
  if ((_r.status ?? 0) !== 0) process.exit(_r.status ?? 1);
}

const [,, commitMsgFile, commitSource] = process.argv;

// Skip merge/squash commits
if (commitSource === 'merge' || commitSource === 'squash') process.exit(0);

let gitDir, gitRoot;
try {
  gitDir  = execSync('git rev-parse --git-dir',        { encoding: 'utf8' }).trim();
  gitRoot = execSync('git rev-parse --show-toplevel',  { encoding: 'utf8' }).trim();
} catch {
  process.exit(0);
}

const sessionFile = resolve(gitDir, '.ai_session_files');
const metaFile    = resolve(gitDir, '.ai_session_meta');
const pendingFlag = resolve(gitDir, '.ai_commit_pending');

const SIMILARITY_THRESHOLD = parseInt(process.env.AI_SIMILARITY_THRESHOLD ?? '70', 10);

// File patterns that skip the similarity check (lockfiles, generated files, binaries)
const SKIP_SIMILARITY_PATTERNS = [
  /\.min\.js$/, /\.min\.css$/, /\.min\.mjs$/,
  /^package-lock\.json$/, /^yarn\.lock$/, /^pnpm-lock\.yaml$/,
  /^Gemfile\.lock$/, /^Cargo\.lock$/, /\.lock$/,
  /\.pb\.go$/, /\.pb\.ts$/, /\.pb\.js$/,
  /\.generated\.ts$/, /\.generated\.js$/, /\.g\.ts$/, /\.g\.dart$/,
];

function shouldSkipSimilarity(filePath) {
  const base = filePath.split('/').pop() ?? filePath;
  return SKIP_SIMILARITY_PATTERNS.some(p => p.test(base));
}

function getStagedFiles() {
  try {
    return execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getStagedHash(relPath) {
  try {
    const out = execSync(`git ls-files -s -- "${relPath}"`, { encoding: 'utf8' }).trim();
    return out ? (out.split(/\s+/)[1] ?? null) : null;
  } catch {
    return null;
  }
}

function getBlobBuffer(hash) {
  const r = spawnSync('git', ['cat-file', 'blob', hash]);
  return r.status === 0 ? r.stdout : null;
}

function getBlobText(hash) {
  const r = spawnSync('git', ['cat-file', 'blob', hash], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}

function isBinary(buffer) {
  return buffer ? buffer.slice(0, 8192).includes(0) : false;
}

function countNonEmptyLines(text) {
  return text.split('\n').filter(l => l.trim().length > 0).length;
}

/** Line-level intersection count (order-insensitive, handles duplicates). */
function countCommonLines(text1, text2) {
  const multiset = new Map();
  for (const l of text1.split('\n').filter(l => l.trim().length > 0)) {
    multiset.set(l, (multiset.get(l) ?? 0) + 1);
  }
  let common = 0;
  for (const l of text2.split('\n').filter(l => l.trim().length > 0)) {
    const c = multiset.get(l) ?? 0;
    if (c > 0) { common++; multiset.set(l, c - 1); }
  }
  return common;
}

// ── Get staged files ──────────────────────────────────────────────────────────
const stagedFiles = getStagedFiles();
if (!stagedFiles.length) process.exit(0);

// ── Determine which AI assistant is active ────────────────────────────────────
// mode: 'session_file' — compare hashes per-file (preferred for all assistants)
//       'author_only'  — add Co-authored-by but no AI-modified: lines
//                        (used when metaFile exists but sessionFile was not written)
//       'blanket'      — tag all staged files (only for cloud Copilot agent with no session file)
let displayName = '';
let email       = '';
let mode        = 'session_file';

if (
  process.env.GITHUB_COPILOT_AGENT ||
  process.env.COPILOT_AGENT_ID ||
  process.env.GITHUB_ACTOR === 'github-copilot[bot]'
) {
  // Copilot cloud agent: blanket is acceptable since the agent runs in isolation
  displayName = 'GitHub Copilot';
  email       = 'github-copilot[bot]@users.noreply.github.com';
  mode = existsSync(sessionFile) ? 'session_file' : 'blanket';
} else if (process.env.AI_ASSISTANT === 'copilot') {
  // Local Copilot: user explicitly declared AI assistance for this shell session.
  // With session file → per-file tracking; without → Co-authored-by only.
  displayName = 'GitHub Copilot';
  email       = 'github-copilot[bot]@users.noreply.github.com';
  mode = existsSync(sessionFile) ? 'session_file' : 'author_only';
} else if (existsSync(sessionFile)) {
  // An AI tool (Claude Code, Copilot with track-ai-edits, etc.) recorded edits.
  // Read identity from meta file; fall back to generic if meta is missing.
  if (existsSync(metaFile)) {
    const meta       = readFileSync(metaFile, 'utf8');
    const nameMatch  = meta.match(/^DISPLAY_NAME=(.+)$/m);
    const emailMatch = meta.match(/^EMAIL=(.+)$/m);
    displayName      = nameMatch?.[1]?.trim()  ?? '';
    email            = emailMatch?.[1]?.trim() ?? '';
  }
  if (!displayName || !email) {
    displayName = 'AI Assistant';
    email       = 'ai-assistant@users.noreply.github.com';
  }
  mode = 'session_file';
} else {
  // No env vars, no session file → no evidence of AI involvement.
  process.exit(0);
}

const coAuthor = `Co-authored-by: ${displayName} <${email}>`;

// Idempotency: bail if already tagged
const existingMsg = readFileSync(commitMsgFile, 'utf8');
if (existingMsg.includes(coAuthor)) process.exit(0);

// ── Identify AI-confirmed staged files ────────────────────────────────────────
let aiConfirmed = [];

if (mode === 'blanket') {
  aiConfirmed = stagedFiles;
} else if (mode === 'author_only') {
  // Co-authored-by will be appended below; no AI-modified: lines needed
} else if (existsSync(sessionFile)) {
  const entries = readFileSync(sessionFile, 'utf8').trim().split('\n').filter(Boolean);

  for (const entry of entries) {
    const tabIdx = entry.indexOf('\t');
    if (tabIdx === -1) continue;
    const aiHash  = entry.slice(0, tabIdx);
    const relPath = entry.slice(tabIdx + 1);
    if (!relPath || !aiHash) continue;
    if (!stagedFiles.includes(relPath)) continue;

    // Skip-similarity: lockfiles and generated files → tag if staged
    const stagedHash = getStagedHash(relPath);
    if (shouldSkipSimilarity(relPath)) {
      if (stagedHash) aiConfirmed.push(relPath);
      continue;
    }

    // Exact hash match: staged content is identical to what AI wrote
    if (stagedHash && stagedHash === aiHash) {
      aiConfirmed.push(relPath);
      continue;
    }

    if (!stagedHash || aiHash === 'unknown') continue;

    // Binary detection: tag without similarity check
    const blobBuf = getBlobBuffer(aiHash);
    if (isBinary(blobBuf)) {
      if (stagedHash) aiConfirmed.push(relPath);
      continue;
    }

    // Similarity check: tag if >= threshold% of AI's lines are still present
    const aiText = getBlobText(aiHash);
    if (!aiText) continue;
    const aiLineCount = countNonEmptyLines(aiText);
    if (aiLineCount === 0) continue;

    const stagedText = getBlobText(stagedHash);
    if (!stagedText) continue;

    const similarity = Math.round(countCommonLines(aiText, stagedText) * 100 / aiLineCount);
    if (similarity >= SIMILARITY_THRESHOLD) {
      aiConfirmed.push(relPath);
    }
    // else: developer discarded / rewrote AI output — do not tag
  }
}

// In 'author_only' mode aiConfirmed is intentionally empty — we still want the Co-authored-by trailer.
if (!aiConfirmed.length && mode !== 'author_only') process.exit(0);

// ── Append attribution trailers ───────────────────────────────────────────────
// AI-modified: uses real git trailers (not comments) so they persist in the
// commit object and are queryable via: git log --grep="AI-modified: path/to/file"

const msgBody = existingMsg.replace(/\s+$/, '');
const trailers = ['', '', coAuthor, ...aiConfirmed.map(f => `AI-modified: ${f}`)].join('\n');

writeFileSync(commitMsgFile, msgBody + trailers + '\n');

// Signal to post-commit that attribution was injected (used to clear session state)
writeFileSync(pendingFlag, '');

process.exit(0);
