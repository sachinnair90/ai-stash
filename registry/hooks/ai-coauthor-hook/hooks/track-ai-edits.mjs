#!/usr/bin/env node
/**
 * AI Hook: track-ai-edits
 * Event: PostToolUse (Claude Code: Edit|MultiEdit|Write ; Copilot: postToolUse)
 *
 * Reads the JSON payload from stdin and records which files were touched by the
 * AI, along with a git blob hash of the file content at write time.
 *
 * Works with both Claude Code and GitHub Copilot coding agent payloads.
 *
 * Session file (.git/.ai_session_files) — one entry per line:
 *   <git-blob-hash>\t<relative-path>
 *
 * Session meta file (.git/.ai_session_meta) — written once per session:
 *   ASSISTANT=copilot|claude
 *   DISPLAY_NAME=GitHub Copilot
 *   EMAIL=github-copilot[bot]@users.noreply.github.com
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';

// ── Git root ──────────────────────────────────────────────────────────────────
function getGitRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const gitRoot = getGitRoot();
if (!gitRoot) process.exit(0);

// ── Read stdin payload ────────────────────────────────────────────────────────
let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8').trim());
} catch {
  process.exit(0);
}

// ── For Copilot postToolUse: skip non-file-write tools ───────────────────────
// VS Code sends tool_name (snake_case); Copilot CLI sent toolName (camelCase)
const _toolName = payload.tool_name ?? payload.toolName;
if (_toolName !== undefined) {
  const tool = String(_toolName).toLowerCase();
  const fileWriteTools = [
    // This Copilot agent's actual tool names
    'replace_string_in_file', 'multi_replace_string_in_file', 'create_file',
    // Claude Code / other agents
    'edit', 'create', 'write', 'str_replace', 'str_replace_based_edit',
  ];
  if (!fileWriteTools.includes(tool)) process.exit(0);
}

// ── Extract file path(s) from either Claude Code or Copilot payload ──────────
function extractFilePaths(p) {
  // VS Code sends tool_input (camelCase props); Copilot CLI sent toolArgs; Claude Code sent tool_input (snake_case)
  // Unify: prefer toolArgs if present (Copilot CLI), otherwise fall back to tool_input (VS Code / Claude Code)
  const rawArgs = p.toolArgs !== undefined ? p.toolArgs : p.tool_input;

  if (rawArgs !== undefined) {
    try {
      const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
      // multi_replace_string_in_file: { replacements: [{ filePath, ... }] }
      if (Array.isArray(args.replacements)) {
        return args.replacements
          .map(r => r?.filePath ?? r?.file_path ?? r?.path)
          .filter(Boolean)
          .map(fp => p.cwd ? resolve(p.cwd, fp) : resolve(fp));
      }
      // Claude Code MultiEdit: { edits: [{ file_path, ... }] }
      if (Array.isArray(args.edits)) {
        return args.edits
          .map(e => e?.file_path ?? e?.filePath)
          .filter(Boolean)
          .map(fp => resolve(fp));
      }
      // Single file: VS Code uses camelCase (filePath), Claude Code uses snake_case (file_path)
      const rawPath = args.filePath ?? args.file_path ?? args.path ?? null;
      if (!rawPath) return [];
      const base = p.cwd ? resolve(p.cwd, rawPath) : resolve(rawPath);
      return [base];
    } catch {
      return [];
    }
  }
  return [];
}

const filePaths = extractFilePaths(payload).filter(fp => existsSync(fp));
if (!filePaths.length) process.exit(0);

// ── Detect assistant for session metadata ────────────────────────────────────
function detectAssistant(p) {
  if (
    process.env.GITHUB_COPILOT_AGENT ||
    process.env.COPILOT_AGENT_ID ||
    process.env.GITHUB_ACTOR === 'github-copilot[bot]' ||
    p.toolName !== undefined
  ) {
    return {
      assistant: 'copilot',
      displayName: 'GitHub Copilot',
      email: 'github-copilot[bot]@users.noreply.github.com',
    };
  }
  const modelId = process.env.CLAUDE_MODEL_ID ?? '';
  return {
    assistant: 'claude',
    displayName: modelId ? `Claude (${modelId})` : 'Claude',
    email: 'noreply@anthropic.com',
  };
}

const sessionFile = resolve(gitRoot, '.git/.ai_session_files');
const metaFile    = resolve(gitRoot, '.git/.ai_session_meta');
const logFile     = resolve(gitRoot, '.git/.ai_session_hook.log');

// Load existing session entries (deduplicated by path)
const existingLines = existsSync(sessionFile)
  ? readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean)
  : [];

const sessionMap = new Map(
  existingLines.map(l => {
    const tab = l.indexOf('\t');
    return tab !== -1 ? [l.slice(tab + 1), l.slice(0, tab)] : [l, ''];
  })
);

const logLines = [];

for (const absPath of filePaths) {
  // Normalize to forward slashes — git always uses '/' regardless of OS
  const relPath = relative(gitRoot, absPath).replace(/\\/g, '/');

  let contentHash;
  try {
    contentHash = execSync(`git hash-object "${absPath}"`, { encoding: 'utf8' }).trim();
  } catch {
    continue;
  }

  sessionMap.set(relPath, contentHash);
  logLines.push(`${new Date().toISOString()}  AI-wrote: ${relPath}  [${contentHash}]`);
}

// Write updated session file
const updatedLines = [...sessionMap.entries()].map(([p, h]) => `${h}\t${p}`);
writeFileSync(sessionFile, updatedLines.join('\n') + '\n');

// Write session metadata once per session (first edit wins)
if (!existsSync(metaFile)) {
  const { assistant, displayName, email } = detectAssistant(payload);
  writeFileSync(metaFile, `ASSISTANT=${assistant}\nDISPLAY_NAME=${displayName}\nEMAIL=${email}\n`);
}

// Append to session log
if (logLines.length) {
  const prev = existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
  writeFileSync(logFile, prev + logLines.join('\n') + '\n');
}

process.exit(0);
