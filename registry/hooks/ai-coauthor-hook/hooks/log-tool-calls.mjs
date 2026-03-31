#!/usr/bin/env node
/**
 * Hook: log-tool-calls
 * Events: PreToolUse, PostToolUse (and all others — register for any event you need)
 *
 * Appends every hook payload as a pretty-printed JSON block to:
 *   .git/.ai_tool_calls.log
 *
 * Use this to inspect the exact structure VS Code / Copilot sends so you can
 * validate / fix other hook scripts.
 *
 * Log format:
 *   ── 2026-03-31T20:00:00.000Z  PostToolUse ──────────────────────────
 *   { ... full JSON payload ... }
 *
 * Tail the file while working:
 *   Get-Content .git/.ai_tool_calls.log -Wait   (PowerShell)
 *   tail -f .git/.ai_tool_calls.log             (bash)
 */

import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

// ── Git root ──────────────────────────────────────────────────────────────────
let gitRoot;
try {
  gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
} catch {
  process.exit(0);
}

// ── Read stdin payload ────────────────────────────────────────────────────────
let raw;
try {
  raw = readFileSync(0, 'utf8').trim();
} catch {
  process.exit(0);
}

if (!raw) process.exit(0);

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  // Not valid JSON — log the raw string anyway so we can see what arrived
  payload = { __raw: raw };
}

// ── Derive a readable event label ─────────────────────────────────────────────
const event =
  payload.hookEventName ??   // VS Code PascalCase
  payload.hook_event_name ?? // possible snake_case variant
  payload.event ??            // generic fallback
  'UnknownEvent';

const toolName =
  payload.tool_name ??   // VS Code
  payload.toolName ??    // Copilot CLI legacy
  null;

const label = toolName ? `${event}  •  ${toolName}` : event;

// ── Append to log ─────────────────────────────────────────────────────────────
const logFile = resolve(gitRoot, '.git/.ai_tool_calls.log');
const separator = '─'.repeat(60);
const header = `\n── ${new Date().toISOString()}  ${label}\n${separator}\n`;
const body = JSON.stringify(payload, null, 2);

appendFileSync(logFile, header + body + '\n');

process.exit(0);
