#!/usr/bin/env node
// Runs after `npm install -g ai-stash`.
// Detects Claude Code and Copilot installations and copies the bundled
// add-asset skill to each one that is present on the machine.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_SRC = path.join(__dirname, '..', 'bundled', 'skills', 'add-asset', 'SKILL.md');
const SKILL_NAME = 'add-asset';

// The directory where the user ran `npm install` (set by npm).
// Falls back to cwd for edge cases (e.g. direct node invocation).
const projectRoot = process.env.INIT_CWD ?? process.cwd();

function detectTargets() {
  const targets = [];

  // Claude Code: global installation lives at ~/.claude/
  const claudeGlobal = path.join(os.homedir(), '.claude');
  if (fs.existsSync(claudeGlobal)) {
    targets.push({
      label: 'Claude Code (global)',
      dest: path.join(claudeGlobal, 'skills', SKILL_NAME, 'SKILL.md'),
    });
  }

  // Claude Code: project-local .claude/ in the directory where npm install ran
  const claudeLocal = path.join(projectRoot, '.claude');
  if (fs.existsSync(claudeLocal)) {
    targets.push({
      label: 'Claude Code (project)',
      dest: path.join(claudeLocal, 'skills', SKILL_NAME, 'SKILL.md'),
    });
  }

  // Copilot: project-local .github/ in the directory where npm install ran
  const copilotLocal = path.join(projectRoot, '.github');
  if (fs.existsSync(copilotLocal)) {
    targets.push({
      label: 'Copilot (project)',
      dest: path.join(copilotLocal, 'skills', SKILL_NAME, 'SKILL.md'),
    });
  }

  return targets;
}

function install(dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(SKILL_SRC, dest);
}

// Bundled skill not present (e.g. running from source before build). Skip silently.
if (!fs.existsSync(SKILL_SRC)) {
  process.exit(0);
}

const targets = detectTargets();

if (targets.length === 0) {
  // Silent — neither Claude Code nor Copilot detected, nothing to do.
  process.exit(0);
}

let installed = 0;
let skipped = 0;

for (const { label, dest } of targets) {
  // Skip if already installed and up-to-date (same content)
  if (fs.existsSync(dest)) {
    const existing = fs.readFileSync(dest, 'utf8');
    const incoming = fs.readFileSync(SKILL_SRC, 'utf8');
    if (existing === incoming) {
      skipped++;
      continue;
    }
  }
  try {
    install(dest);
    console.log(`ai-stash: installed add-asset skill → ${label}`);
    installed++;
  } catch (err) {
    // Non-fatal — the user can still use the TUI manually.
    console.warn(`ai-stash: could not install add-asset skill for ${label}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (installed === 0 && skipped > 0) {
  // Everything was already current — don't print anything.
}
