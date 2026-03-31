/**
 * Tests for the ai-coauthor-hook scripts.
 *
 * Each test creates a real temporary git repo and runs the hook scripts as
 * subprocesses so we exercise the exact same code paths as a real git commit.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Each test spawns subprocesses in real git repos — generous timeout needed.
const TEST_TIMEOUT = 15000;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const SCRIPTS_DIR = resolve(__dirname, '..', 'scripts');
const HOOKS_DIR   = resolve(__dirname, '..', 'hooks');

const PREPARE_COMMIT_MSG = resolve(SCRIPTS_DIR, 'prepare-commit-msg.mjs');
const POST_COMMIT        = resolve(SCRIPTS_DIR, 'post-commit.mjs');
const TRACK_AI_EDITS     = resolve(HOOKS_DIR, 'track-ai-edits.mjs');
const SESSION_START      = resolve(HOOKS_DIR, 'session-start.mjs');

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Create a temp git repo with one initial commit. */
function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ai-hook-test-'));
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });
  writeFileSync(join(dir, 'init.txt'), 'init\n');
  execSync('git add init.txt', { cwd: dir, stdio: 'ignore' });
  execSync('git commit -m "init"', { cwd: dir, stdio: 'ignore' });
  return dir;
}

/** Run a hook script in the temp repo. Returns { status, stdout, stderr }. */
function runScript(script, args, cwd, opts = {}) {
  const { env = {}, stdin = '' } = opts;
  const result = spawnSync('node', [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env, HOME: cwd, USERPROFILE: cwd },
    input: stdin,
    timeout: 15000,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/** Stage a file and create COMMIT_EDITMSG. Returns the commit-msg file path. */
function stageFileAndPrepareMsg(dir, filename, content, commitMsg = 'test commit') {
  writeFileSync(join(dir, filename), content);
  execSync(`git add "${filename}"`, { cwd: dir, stdio: 'ignore' });
  const msgFile = join(dir, 'COMMIT_EDITMSG');
  writeFileSync(msgFile, commitMsg);
  return msgFile;
}

/** Read the .git dir path for a repo (always absolute). */
function gitDir(repoDir) {
  const rel = execSync('git rev-parse --git-dir', { cwd: repoDir, encoding: 'utf8' }).trim();
  return resolve(repoDir, rel);
}

/** Write a session file entry. */
function writeSessionFile(dir, entries) {
  const gd = gitDir(dir);
  const lines = entries.map(([hash, path]) => `${hash}\t${path}`).join('\n') + '\n';
  writeFileSync(resolve(gd, '.ai_session_files'), lines);
}

/** Write a meta file. */
function writeMetaFile(dir, assistant, displayName, email) {
  const gd = gitDir(dir);
  writeFileSync(
    resolve(gd, '.ai_session_meta'),
    `ASSISTANT=${assistant}\nDISPLAY_NAME=${displayName}\nEMAIL=${email}\n`,
  );
}

/** Get the git blob hash of file content. */
function hashObject(dir, filename) {
  return execSync(`git hash-object "${join(dir, filename)}"`, {
    cwd: dir,
    encoding: 'utf8',
  }).trim();
}

// ── Test setup / teardown ───────────────────────────────────────────────────

let dir;

beforeEach(() => {
  dir = makeTempRepo();
});

afterEach(() => {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ═════════════════════════════════════════════════════════════════════════════
// prepare-commit-msg
// ═════════════════════════════════════════════════════════════════════════════

describe('prepare-commit-msg', { timeout: TEST_TIMEOUT }, () => {
  // ── No AI involvement ───────────────────────────────────────────────────

  it('does nothing when no AI signals are present', () => {
    const msgFile = stageFileAndPrepareMsg(dir, 'a.txt', 'hello');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir);
    expect(r.status).toBe(0);
    expect(readFileSync(msgFile, 'utf8')).toBe('test commit');
  });

  it('does nothing on merge commits', () => {
    const msgFile = stageFileAndPrepareMsg(dir, 'a.txt', 'hello');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile, 'merge'], dir);
    expect(r.status).toBe(0);
    expect(readFileSync(msgFile, 'utf8')).toBe('test commit');
  });

  it('does nothing on squash commits', () => {
    const msgFile = stageFileAndPrepareMsg(dir, 'a.txt', 'hello');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile, 'squash'], dir);
    expect(r.status).toBe(0);
    expect(readFileSync(msgFile, 'utf8')).toBe('test commit');
  });

  // ── Stale metadata (Bug 1 fix) ─────────────────────────────────────────

  it('does NOT attribute when only .ai_session_meta exists (no session file, no env)', () => {
    writeMetaFile(dir, 'copilot', 'GitHub Copilot', 'github-copilot[bot]@users.noreply.github.com');
    const msgFile = stageFileAndPrepareMsg(dir, 'a.txt', 'manual edit');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).not.toContain('Co-authored-by');
    expect(msg).not.toContain('AI-modified');
  });

  // ── Cloud Copilot agent (blanket mode) ──────────────────────────────────

  it('blanket-tags all staged files for cloud Copilot agent (GITHUB_COPILOT_AGENT)', () => {
    const msgFile = stageFileAndPrepareMsg(dir, 'a.txt', 'copilot wrote this');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir, {
      env: { GITHUB_COPILOT_AGENT: '1' },
    });
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('Co-authored-by: GitHub Copilot');
    expect(msg).toContain('AI-modified: a.txt');
  });

  it('blanket-tags all staged files for cloud Copilot agent (COPILOT_AGENT_ID)', () => {
    const msgFile = stageFileAndPrepareMsg(dir, 'a.txt', 'copilot wrote this');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir, {
      env: { COPILOT_AGENT_ID: 'some-id' },
    });
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('Co-authored-by: GitHub Copilot');
    expect(msg).toContain('AI-modified: a.txt');
  });

  it('blanket-tags all staged files for cloud Copilot agent (GITHUB_ACTOR)', () => {
    const msgFile = stageFileAndPrepareMsg(dir, 'a.txt', 'copilot wrote this');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir, {
      env: { GITHUB_ACTOR: 'github-copilot[bot]' },
    });
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('Co-authored-by: GitHub Copilot');
  });

  it('prefers session_file mode for cloud Copilot when session file exists', () => {
    writeFileSync(join(dir, 'a.txt'), 'ai wrote this');
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' });
    const aiHash = hashObject(dir, 'a.txt');
    writeSessionFile(dir, [[aiHash, 'a.txt']]);

    // Also stage a file NOT in the session
    writeFileSync(join(dir, 'b.txt'), 'manual file');
    execSync('git add b.txt', { cwd: dir, stdio: 'ignore' });

    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, 'feat: something');

    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir, {
      env: { GITHUB_COPILOT_AGENT: '1' },
    });
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('AI-modified: a.txt');
    // b.txt should NOT be tagged because session_file mode was used
    expect(msg).not.toContain('AI-modified: b.txt');
  });

  // ── AI_ASSISTANT=copilot (local Copilot, author_only mode) ──────────────

  it('adds only Co-authored-by when AI_ASSISTANT=copilot and no session file', () => {
    const msgFile = stageFileAndPrepareMsg(dir, 'a.txt', 'some content');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir, {
      env: { AI_ASSISTANT: 'copilot' },
    });
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('Co-authored-by: GitHub Copilot');
    expect(msg).not.toContain('AI-modified');
  });

  it('uses session_file mode when AI_ASSISTANT=copilot AND session file exists', () => {
    writeFileSync(join(dir, 'a.txt'), 'ai content');
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' });
    const aiHash = hashObject(dir, 'a.txt');
    writeSessionFile(dir, [[aiHash, 'a.txt']]);

    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, 'feat: copilot assist');

    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir, {
      env: { AI_ASSISTANT: 'copilot' },
    });
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('Co-authored-by: GitHub Copilot');
    expect(msg).toContain('AI-modified: a.txt');
  });

  // ── Session file with meta (Claude Code / generic AI) ──────────────────

  it('attributes with Claude identity when session file and meta exist', () => {
    writeFileSync(join(dir, 'a.txt'), 'claude wrote');
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' });
    const aiHash = hashObject(dir, 'a.txt');
    writeSessionFile(dir, [[aiHash, 'a.txt']]);
    writeMetaFile(dir, 'claude', 'Claude (claude-3-opus)', 'noreply@anthropic.com');

    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, 'feat: claude assist');

    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('Co-authored-by: Claude (claude-3-opus) <noreply@anthropic.com>');
    expect(msg).toContain('AI-modified: a.txt');
  });

  // ── Session file without meta (generic fallback) ───────────────────────

  it('uses generic AI Assistant fallback when session file exists but no meta', () => {
    writeFileSync(join(dir, 'a.txt'), 'some ai wrote');
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' });
    const aiHash = hashObject(dir, 'a.txt');
    writeSessionFile(dir, [[aiHash, 'a.txt']]);

    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, 'feat: ai assist');

    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('Co-authored-by: AI Assistant <ai-assistant@users.noreply.github.com>');
    expect(msg).toContain('AI-modified: a.txt');
  });

  it('uses generic fallback when meta has empty DISPLAY_NAME', () => {
    writeFileSync(join(dir, 'a.txt'), 'content');
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' });
    const aiHash = hashObject(dir, 'a.txt');
    writeSessionFile(dir, [[aiHash, 'a.txt']]);

    const gd = gitDir(dir);
    writeFileSync(resolve(gd, '.ai_session_meta'), 'ASSISTANT=unknown\nDISPLAY_NAME=\nEMAIL=\n');

    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, 'feat: unknown ai');

    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('Co-authored-by: AI Assistant <ai-assistant@users.noreply.github.com>');
  });

  // ── Similarity threshold ────────────────────────────────────────────────

  it('tags file when staged content is similar enough (>= 70%)', () => {
    // Write original AI content and store in git's object database
    const aiContent = Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n') + '\n';
    writeFileSync(join(dir, 'a.txt'), aiContent);
    const aiHash = execSync(`git hash-object -w "${join(dir, 'a.txt')}"`, {
      cwd: dir, encoding: 'utf8',
    }).trim();

    // Modify slightly (<30% change) and stage
    const modifiedContent = Array.from({ length: 10 }, (_, i) =>
      i < 2 ? `changed ${i}` : `line ${i}`
    ).join('\n') + '\n';
    writeFileSync(join(dir, 'a.txt'), modifiedContent);
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' });

    writeSessionFile(dir, [[aiHash, 'a.txt']]);
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');

    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, 'feat: similar');

    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('AI-modified: a.txt');
  });

  it('does NOT tag file when content was largely rewritten (< 70%)', () => {
    // Write original AI content
    const aiContent = Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n') + '\n';
    writeFileSync(join(dir, 'a.txt'), aiContent);

    // We need the AI hash stored in git's object database
    const aiHash = execSync(`git hash-object -w "${join(dir, 'a.txt')}"`, {
      cwd: dir, encoding: 'utf8',
    }).trim();

    // Rewrite almost entirely (>30% change → <70% similarity)
    const rewrittenContent = Array.from({ length: 10 }, (_, i) => `completely different ${i}`).join('\n') + '\n';
    writeFileSync(join(dir, 'a.txt'), rewrittenContent);
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' });

    writeSessionFile(dir, [[aiHash, 'a.txt']]);
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');

    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, 'feat: rewritten');

    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).not.toContain('AI-modified');
    expect(msg).not.toContain('Co-authored-by');
  });

  // ── Skip-similarity for lockfiles ───────────────────────────────────────

  it('tags lockfiles without similarity check', () => {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfile: v9\n');
    execSync('git add pnpm-lock.yaml', { cwd: dir, stdio: 'ignore' });

    // Use a bogus AI hash — should still tag because similarity is skipped
    writeSessionFile(dir, [['0000000000000000000000000000000000000000', 'pnpm-lock.yaml']]);
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');

    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, 'chore: lock');

    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('AI-modified: pnpm-lock.yaml');
  });

  // ── Idempotency ────────────────────────────────────────────────────────

  it('does not duplicate Co-authored-by when already present', () => {
    const existing = 'feat: stuff\n\nCo-authored-by: GitHub Copilot <github-copilot[bot]@users.noreply.github.com>\n';
    writeFileSync(join(dir, 'a.txt'), 'content');
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' });

    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, existing);

    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir, {
      env: { AI_ASSISTANT: 'copilot' },
    });
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toBe(existing); // unchanged
  });

  // ── Files not in session → not tagged ───────────────────────────────────

  it('only tags files that appear in the session file', () => {
    writeFileSync(join(dir, 'ai-file.txt'), 'ai content');
    writeFileSync(join(dir, 'manual-file.txt'), 'manual content');
    execSync('git add ai-file.txt manual-file.txt', { cwd: dir, stdio: 'ignore' });

    const aiHash = hashObject(dir, 'ai-file.txt');
    writeSessionFile(dir, [[aiHash, 'ai-file.txt']]);
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');

    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, 'feat: mixed');

    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('AI-modified: ai-file.txt');
    expect(msg).not.toContain('AI-modified: manual-file.txt');
  });

  // ── Multiple AI files ──────────────────────────────────────────────────

  it('tags multiple AI-modified files', () => {
    writeFileSync(join(dir, 'a.txt'), 'ai a');
    writeFileSync(join(dir, 'b.txt'), 'ai b');
    execSync('git add a.txt b.txt', { cwd: dir, stdio: 'ignore' });

    const hashA = hashObject(dir, 'a.txt');
    const hashB = hashObject(dir, 'b.txt');
    writeSessionFile(dir, [[hashA, 'a.txt'], [hashB, 'b.txt']]);
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');

    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, 'feat: multi');

    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toContain('AI-modified: a.txt');
    expect(msg).toContain('AI-modified: b.txt');
    // Only one Co-authored-by
    expect(msg.match(/Co-authored-by/g)).toHaveLength(1);
  });

  // ── No staged files → exit ─────────────────────────────────────────────

  it('exits cleanly when there are no staged files', () => {
    // Don't stage anything
    const msgFile = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile, 'empty commit');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir, {
      env: { GITHUB_COPILOT_AGENT: '1' },
    });
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).toBe('empty commit');
  });

  // ── Session file entries that are not staged → ignored ──────────────────

  it('ignores session entries for files that are not staged', () => {
    writeFileSync(join(dir, 'a.txt'), 'not staged');
    const aiHash = hashObject(dir, 'a.txt');
    writeSessionFile(dir, [[aiHash, 'a.txt']]);
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');

    // Stage a different file
    const msgFile = stageFileAndPrepareMsg(dir, 'b.txt', 'manual');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    expect(msg).not.toContain('Co-authored-by');
  });

  // ── Pending flag ────────────────────────────────────────────────────────

  it('creates .ai_commit_pending flag when attribution is injected', () => {
    const msgFile = stageFileAndPrepareMsg(dir, 'a.txt', 'content');
    runScript(PREPARE_COMMIT_MSG, [msgFile], dir, {
      env: { AI_ASSISTANT: 'copilot' },
    });
    const gd = gitDir(dir);
    expect(existsSync(resolve(gd, '.ai_commit_pending'))).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// post-commit
// ═════════════════════════════════════════════════════════════════════════════

describe('post-commit', { timeout: TEST_TIMEOUT }, () => {
  it('cleans up session file, meta file, AND pending flag', () => {
    const gd = gitDir(dir);
    writeFileSync(resolve(gd, '.ai_session_files'), 'abc123\tfile.txt\n');
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');
    writeFileSync(resolve(gd, '.ai_commit_pending'), '');

    const r = runScript(POST_COMMIT, [], dir);
    expect(r.status).toBe(0);
    expect(existsSync(resolve(gd, '.ai_session_files'))).toBe(false);
    expect(existsSync(resolve(gd, '.ai_session_meta'))).toBe(false);
    expect(existsSync(resolve(gd, '.ai_commit_pending'))).toBe(false);
  });

  it('does nothing when no pending flag exists', () => {
    const gd = gitDir(dir);
    writeFileSync(resolve(gd, '.ai_session_files'), 'abc123\tfile.txt\n');
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');

    const r = runScript(POST_COMMIT, [], dir);
    expect(r.status).toBe(0);
    // Files should be preserved — nothing happened
    expect(existsSync(resolve(gd, '.ai_session_files'))).toBe(true);
    expect(existsSync(resolve(gd, '.ai_session_meta'))).toBe(true);
  });

  it('handles partial cleanup (only pending flag present)', () => {
    const gd = gitDir(dir);
    writeFileSync(resolve(gd, '.ai_commit_pending'), '');
    // No session file or meta file
    const r = runScript(POST_COMMIT, [], dir);
    expect(r.status).toBe(0);
    expect(existsSync(resolve(gd, '.ai_commit_pending'))).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// End-to-end: stale metadata regression (Bug 1)
// ═════════════════════════════════════════════════════════════════════════════

describe('stale metadata regression', { timeout: TEST_TIMEOUT }, () => {
  it('manual commit after AI session does NOT get false attribution', () => {
    // 1. Simulate AI session: create session + meta, commit with attribution
    writeFileSync(join(dir, 'ai.txt'), 'ai content');
    execSync('git add ai.txt', { cwd: dir, stdio: 'ignore' });
    const aiHash = hashObject(dir, 'ai.txt');
    writeSessionFile(dir, [[aiHash, 'ai.txt']]);
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');

    const msgFile1 = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile1, 'feat: ai commit');

    runScript(PREPARE_COMMIT_MSG, [msgFile1], dir);
    expect(readFileSync(msgFile1, 'utf8')).toContain('Co-authored-by');

    // 2. post-commit cleans up
    runScript(POST_COMMIT, [], dir);
    execSync('git commit -m "feat: ai commit"', { cwd: dir, stdio: 'ignore' });

    // 3. New manual commit — should NOT get any attribution
    const msgFile2 = stageFileAndPrepareMsg(dir, 'manual.txt', 'manual edit', 'chore: manual');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile2], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile2, 'utf8');
    expect(msg).toBe('chore: manual');
    expect(msg).not.toContain('Co-authored-by');
  });

  it('second AI commit in same session still gets attribution (track-ai-edits recreates state)', () => {
    // 1. First AI edit + commit
    writeFileSync(join(dir, 'a.txt'), 'ai content 1');
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' });
    const hash1 = hashObject(dir, 'a.txt');
    writeSessionFile(dir, [[hash1, 'a.txt']]);
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');

    const msgFile1 = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile1, 'feat: first ai');
    runScript(PREPARE_COMMIT_MSG, [msgFile1], dir);
    runScript(POST_COMMIT, [], dir);
    execSync('git commit -m "feat: first ai"', { cwd: dir, stdio: 'ignore' });

    // 2. Verify cleanup happened
    const gd = gitDir(dir);
    expect(existsSync(resolve(gd, '.ai_session_meta'))).toBe(false);
    expect(existsSync(resolve(gd, '.ai_session_files'))).toBe(false);

    // 3. Second AI edit (track-ai-edits recreates both files)
    writeFileSync(join(dir, 'b.txt'), 'ai content 2');
    execSync('git add b.txt', { cwd: dir, stdio: 'ignore' });
    const hash2 = hashObject(dir, 'b.txt');
    writeSessionFile(dir, [[hash2, 'b.txt']]);
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');

    const msgFile2 = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msgFile2, 'feat: second ai');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile2], dir);
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile2, 'utf8');
    expect(msg).toContain('Co-authored-by: Claude');
    expect(msg).toContain('AI-modified: b.txt');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// track-ai-edits
// ═════════════════════════════════════════════════════════════════════════════

describe('track-ai-edits', { timeout: TEST_TIMEOUT }, () => {
  it('records file hash for Claude Code Edit tool', () => {
    writeFileSync(join(dir, 'src.ts'), 'export const x = 1;');
    const payload = {
      tool_name: 'Edit',
      tool_input: { file_path: join(dir, 'src.ts') },
    };
    const r = runScript(TRACK_AI_EDITS, [], dir, {
      stdin: JSON.stringify(payload),
    });
    expect(r.status).toBe(0);

    const gd = gitDir(dir);
    const session = readFileSync(resolve(gd, '.ai_session_files'), 'utf8');
    expect(session).toContain('src.ts');
    // Should have a valid 40-char hash
    const hash = session.split('\t')[0];
    expect(hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it('records file hash for Copilot create_file tool', () => {
    writeFileSync(join(dir, 'new.ts'), 'new file content');
    const payload = {
      toolName: 'create_file',
      toolArgs: JSON.stringify({ filePath: join(dir, 'new.ts') }),
      cwd: dir,
    };
    const r = runScript(TRACK_AI_EDITS, [], dir, {
      stdin: JSON.stringify(payload),
    });
    expect(r.status).toBe(0);

    const gd = gitDir(dir);
    const session = readFileSync(resolve(gd, '.ai_session_files'), 'utf8');
    expect(session).toContain('new.ts');
  });

  it('writes Copilot identity in meta for Copilot payload', () => {
    writeFileSync(join(dir, 'f.txt'), 'content');
    const payload = {
      toolName: 'create_file',
      toolArgs: JSON.stringify({ filePath: join(dir, 'f.txt') }),
      cwd: dir,
    };
    const r = runScript(TRACK_AI_EDITS, [], dir, {
      stdin: JSON.stringify(payload),
    });
    expect(r.status).toBe(0);

    const gd = gitDir(dir);
    const meta = readFileSync(resolve(gd, '.ai_session_meta'), 'utf8');
    expect(meta).toContain('DISPLAY_NAME=GitHub Copilot');
    expect(meta).toContain('EMAIL=github-copilot[bot]@users.noreply.github.com');
  });

  it('writes Claude identity in meta for Claude Code payload', () => {
    writeFileSync(join(dir, 'f.txt'), 'content');
    const payload = {
      tool_name: 'Edit',
      tool_input: { file_path: join(dir, 'f.txt') },
    };
    const r = runScript(TRACK_AI_EDITS, [], dir, {
      stdin: JSON.stringify(payload),
    });
    expect(r.status).toBe(0);

    const gd = gitDir(dir);
    const meta = readFileSync(resolve(gd, '.ai_session_meta'), 'utf8');
    expect(meta).toContain('ASSISTANT=claude');
    expect(meta).toContain('DISPLAY_NAME=Claude');
  });

  it('does not overwrite existing meta file', () => {
    const gd = gitDir(dir);
    writeMetaFile(dir, 'copilot', 'GitHub Copilot', 'github-copilot[bot]@users.noreply.github.com');

    writeFileSync(join(dir, 'f.txt'), 'content');
    // Send a Claude payload — but meta should NOT be overwritten
    const payload = {
      tool_name: 'Edit',
      tool_input: { file_path: join(dir, 'f.txt') },
    };
    runScript(TRACK_AI_EDITS, [], dir, { stdin: JSON.stringify(payload) });

    const meta = readFileSync(resolve(gd, '.ai_session_meta'), 'utf8');
    expect(meta).toContain('DISPLAY_NAME=GitHub Copilot');
    expect(meta).not.toContain('DISPLAY_NAME=Claude');
  });

  it('skips non-file-write tools for Copilot', () => {
    const payload = { toolName: 'read_file', toolArgs: '{}', cwd: dir };
    const r = runScript(TRACK_AI_EDITS, [], dir, {
      stdin: JSON.stringify(payload),
    });
    expect(r.status).toBe(0);
    const gd = gitDir(dir);
    expect(existsSync(resolve(gd, '.ai_session_files'))).toBe(false);
  });

  it('handles multi_replace_string_in_file with multiple files', () => {
    writeFileSync(join(dir, 'a.ts'), 'a');
    writeFileSync(join(dir, 'b.ts'), 'b');
    const payload = {
      toolName: 'multi_replace_string_in_file',
      toolArgs: JSON.stringify({
        replacements: [
          { filePath: join(dir, 'a.ts') },
          { filePath: join(dir, 'b.ts') },
        ],
      }),
      cwd: dir,
    };
    const r = runScript(TRACK_AI_EDITS, [], dir, {
      stdin: JSON.stringify(payload),
    });
    expect(r.status).toBe(0);

    const gd = gitDir(dir);
    const session = readFileSync(resolve(gd, '.ai_session_files'), 'utf8');
    expect(session).toContain('a.ts');
    expect(session).toContain('b.ts');
  });

  it('updates hash when same file is edited again', () => {
    const gd = gitDir(dir);

    // First edit
    writeFileSync(join(dir, 'f.txt'), 'version 1');
    const payload1 = {
      tool_name: 'Edit',
      tool_input: { file_path: join(dir, 'f.txt') },
    };
    runScript(TRACK_AI_EDITS, [], dir, { stdin: JSON.stringify(payload1) });
    const session1 = readFileSync(resolve(gd, '.ai_session_files'), 'utf8');
    const hash1 = session1.split('\t')[0];

    // Second edit — different content
    writeFileSync(join(dir, 'f.txt'), 'version 2');
    const payload2 = {
      tool_name: 'Edit',
      tool_input: { file_path: join(dir, 'f.txt') },
    };
    runScript(TRACK_AI_EDITS, [], dir, { stdin: JSON.stringify(payload2) });
    const session2 = readFileSync(resolve(gd, '.ai_session_files'), 'utf8');
    const hash2 = session2.split('\t')[0];

    expect(hash1).not.toBe(hash2);
    // Should only have one entry for the file
    const lines = session2.trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// session-start (Copilot)
// ═════════════════════════════════════════════════════════════════════════════

describe('session-start', { timeout: TEST_TIMEOUT }, () => {
  it('writes Copilot identity (not generic) to meta file', () => {
    const r = runScript(SESSION_START, [], dir, { stdin: '{}' });
    expect(r.status).toBe(0);

    const gd = gitDir(dir);
    const meta = readFileSync(resolve(gd, '.ai_session_meta'), 'utf8');
    expect(meta).toContain('DISPLAY_NAME=GitHub Copilot');
    expect(meta).toContain('EMAIL=github-copilot[bot]@users.noreply.github.com');
    expect(meta).toContain('ASSISTANT=copilot');
  });

  it('does not overwrite existing meta file', () => {
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');
    runScript(SESSION_START, [], dir, { stdin: '{}' });

    const gd = gitDir(dir);
    const meta = readFileSync(resolve(gd, '.ai_session_meta'), 'utf8');
    expect(meta).toContain('DISPLAY_NAME=Claude');
    expect(meta).not.toContain('GitHub Copilot');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Full end-to-end: commit cycle with cleanup
// ═════════════════════════════════════════════════════════════════════════════

describe('end-to-end commit cycle', { timeout: TEST_TIMEOUT * 3 }, () => {
  it('AI commit → cleanup → manual commit is clean', () => {
    // AI writes a file
    writeFileSync(join(dir, 'feature.ts'), 'export const x = 1;');
    execSync('git add feature.ts', { cwd: dir, stdio: 'ignore' });
    const aiHash = hashObject(dir, 'feature.ts');
    writeSessionFile(dir, [[aiHash, 'feature.ts']]);
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');

    // prepare-commit-msg adds attribution
    const msg1 = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(msg1, 'feat: ai feature');
    runScript(PREPARE_COMMIT_MSG, [msg1], dir);
    const aiCommitMsg = readFileSync(msg1, 'utf8');
    expect(aiCommitMsg).toContain('Co-authored-by: Claude');
    expect(aiCommitMsg).toContain('AI-modified: feature.ts');

    // post-commit cleans up
    runScript(POST_COMMIT, [], dir);

    // Actually commit to advance HEAD
    execSync('git commit -m "feat: ai feature"', { cwd: dir, stdio: 'ignore' });

    // Now a purely manual edit — should be completely clean
    const msg2 = stageFileAndPrepareMsg(dir, 'readme.md', '# Manual', 'docs: add readme');
    runScript(PREPARE_COMMIT_MSG, [msg2], dir);
    const manualMsg = readFileSync(msg2, 'utf8');
    expect(manualMsg).toBe('docs: add readme');
  });

  it('interleaved AI and manual commits across sessions', () => {
    // Session 1: AI commit
    writeFileSync(join(dir, 'a.ts'), 'ai 1');
    execSync('git add a.ts', { cwd: dir, stdio: 'ignore' });
    const h1 = hashObject(dir, 'a.ts');
    writeSessionFile(dir, [[h1, 'a.ts']]);
    writeMetaFile(dir, 'claude', 'Claude', 'noreply@anthropic.com');
    const m1 = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(m1, 'feat: ai 1');
    runScript(PREPARE_COMMIT_MSG, [m1], dir);
    expect(readFileSync(m1, 'utf8')).toContain('Co-authored-by');
    runScript(POST_COMMIT, [], dir);
    execSync('git commit -m "feat: ai 1"', { cwd: dir, stdio: 'ignore' });

    // Manual commit
    const m2 = stageFileAndPrepareMsg(dir, 'b.ts', 'manual', 'chore: manual');
    runScript(PREPARE_COMMIT_MSG, [m2], dir);
    expect(readFileSync(m2, 'utf8')).toBe('chore: manual');
    execSync('git commit -m "chore: manual"', { cwd: dir, stdio: 'ignore' });

    // Session 2: AI commit (different assistant)
    writeFileSync(join(dir, 'c.ts'), 'copilot 1');
    execSync('git add c.ts', { cwd: dir, stdio: 'ignore' });
    const h3 = hashObject(dir, 'c.ts');
    writeSessionFile(dir, [[h3, 'c.ts']]);
    writeMetaFile(dir, 'copilot', 'GitHub Copilot', 'github-copilot[bot]@users.noreply.github.com');
    const m3 = join(dir, 'COMMIT_EDITMSG');
    writeFileSync(m3, 'feat: copilot');
    runScript(PREPARE_COMMIT_MSG, [m3], dir);
    const copilotMsg = readFileSync(m3, 'utf8');
    expect(copilotMsg).toContain('Co-authored-by: GitHub Copilot');
    expect(copilotMsg).toContain('AI-modified: c.ts');
    runScript(POST_COMMIT, [], dir);
    execSync('git commit -m "feat: copilot"', { cwd: dir, stdio: 'ignore' });

    // Another manual commit — still clean
    const m4 = stageFileAndPrepareMsg(dir, 'd.ts', 'manual 2', 'chore: manual 2');
    runScript(PREPARE_COMMIT_MSG, [m4], dir);
    expect(readFileSync(m4, 'utf8')).toBe('chore: manual 2');
  });

  it('AI_ASSISTANT=copilot local flow with no file tracking', () => {
    const msgFile = stageFileAndPrepareMsg(dir, 'a.txt', 'copilot edit');
    const r = runScript(PREPARE_COMMIT_MSG, [msgFile], dir, {
      env: { AI_ASSISTANT: 'copilot' },
    });
    expect(r.status).toBe(0);
    const msg = readFileSync(msgFile, 'utf8');
    // Should add Co-authored-by but NO AI-modified (no tracking data)
    expect(msg).toContain('Co-authored-by: GitHub Copilot');
    expect(msg).not.toContain('AI-modified');
  });
});
