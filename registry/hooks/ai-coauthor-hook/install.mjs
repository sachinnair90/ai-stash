#!/usr/bin/env node
/**
 * install.mjs — AI Co-Author Hook Installer
 *
 * Usage:
 *   node install.mjs [options]
 *
 *   --claude          Install Claude Code hooks (default when no platform given)
 *   --copilot         Install GitHub Copilot coding agent hooks
 *   --global          Install Claude Code hooks globally (~/.claude/settings.json)
 *   --project <path>  Target project directory (default: current directory)
 *   --git-global      Install git hooks as a global git template
 *
 * Claude Code installation:
 *   1. Copies hooks/track-ai-edits.mjs and hooks/session-stop.mjs to
 *      .claude/hooks/ai-coauthor-hook/ (or ~/.claude/hooks/... if --global)
 *   2. Merges hook entries into .claude/settings.json
 *   3. Installs git hooks (prepare-commit-msg, post-commit) into .git/hooks/
 *
 * Copilot coding agent installation:
 *   1. Copies hooks/*.mjs     → .github/hooks/
 *   2. Copies scripts/*.mjs   → .github/hooks/git/   (agent installs these at sessionStart)
 *   3. Creates/updates        → .github/hooks/hooks.json
 *   4. Installs git hooks locally for developer commits
 *
 *   Commit .github/hooks/ to your repository so the Copilot agent can use them.
 */

import {
  copyFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import * as os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Terminal colours (only when stdout is a TTY) ──────────────────────────────
const isTTY  = process.stdout.isTTY;
const GREEN  = isTTY ? '\x1b[0;32m' : '';
const YELLOW = isTTY ? '\x1b[1;33m' : '';
const RED    = isTTY ? '\x1b[0;31m' : '';
const NC     = isTTY ? '\x1b[0m'    : '';

const info  = (msg) => console.log(`${GREEN}+${NC}  ${msg}`);
const warn  = (msg) => console.log(`${YELLOW}!${NC}  ${msg}`);
const error = (msg) => { console.error(`${RED}x${NC}  ${msg}`); process.exit(1); };

// ── Parse arguments ───────────────────────────────────────────────────────────
let installClaude  = false;
let installCopilot = false;
let globalClaude   = false;
let gitGlobal      = false;
let projectDir     = process.cwd();

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--claude':     installClaude  = true; break;
    case '--copilot':    installCopilot = true; break;
    case '--global':     globalClaude   = true; break;
    case '--git-global': gitGlobal      = true; break;
    case '--project':
      if (!args[i + 1]) error('--project requires a path');
      projectDir = resolve(args[++i]);
      break;
    case '-h':
    case '--help':
      // Print the JSDoc block at the top of this file as help text
      console.log(
        readFileSync(__filename, 'utf8')
          .match(/\/\*\*([\s\S]*?)\*\//)?.[1]
          ?.replace(/^ \* ?/gm, '')
          ?.trim() ?? ''
      );
      process.exit(0);
    default:
      error(`Unknown argument: ${args[i]}`);
  }
}

// Default: just Claude Code if neither flag given
if (!installClaude && !installCopilot) installClaude = true;

// ── Claude Code installation ──────────────────────────────────────────────────
if (installClaude) {
  const claudeSettingsDir = globalClaude
    ? resolve(os.homedir(), '.claude')
    : resolve(projectDir, '.claude');

  const hooksInstallDir = resolve(claudeSettingsDir, 'hooks', 'ai-coauthor-hook');
  mkdirSync(hooksInstallDir, { recursive: true });

  // Copy Claude Code hook scripts
  const hooksSrc = resolve(__dirname, 'hooks');
  for (const f of ['track-ai-edits.mjs', 'session-stop.mjs']) {
    copyFileSync(resolve(hooksSrc, f), resolve(hooksInstallDir, f));
  }
  info(`Copied Claude Code hook scripts → ${hooksInstallDir}`);

  // Merge hook entries into Claude settings.json
  const settingsFile = resolve(claudeSettingsDir, 'settings.json');
  mkdirSync(claudeSettingsDir, { recursive: true });
  if (!existsSync(settingsFile)) writeFileSync(settingsFile, '{}\n');

  const settings    = JSON.parse(readFileSync(settingsFile, 'utf8'));
  const trackCmd    = resolve(hooksInstallDir, 'track-ai-edits.mjs');
  const stopCmd     = resolve(hooksInstallDir, 'session-stop.mjs');

  const newHooks = {
    PostToolUse: [
      {
        matcher: 'Edit|MultiEdit|Write',
        hooks: [{ type: 'command', command: `node "${trackCmd}"`, timeout: 10 }],
      },
    ],
    Stop: [
      {
        matcher: '',
        hooks: [{ type: 'command', command: `node "${stopCmd}"`, timeout: 10 }],
      },
    ],
  };

  const existingHooks = settings.hooks ?? {};
  for (const [event, entries] of Object.entries(newHooks)) {
    const existing = existingHooks[event] ?? [];
    for (const entry of entries) {
      const installedCmds = existing.flatMap(b => (b.hooks ?? []).map(h => h.command));
      const newCmds       = (entry.hooks ?? []).map(h => h.command);
      if (!newCmds.some(c => installedCmds.includes(c))) existing.push(entry);
    }
    existingHooks[event] = existing;
  }
  settings.hooks = existingHooks;
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  info(`Updated Claude settings → ${settingsFile}`);

  installGitHooks(projectDir, gitGlobal);
}

// ── Copilot coding agent installation ────────────────────────────────────────
if (installCopilot) {
  const dotGithubHooks = resolve(projectDir, '.github', 'hooks');
  const gitSubdir      = resolve(dotGithubHooks, 'git');
  mkdirSync(dotGithubHooks, { recursive: true });
  mkdirSync(gitSubdir,      { recursive: true });

  // Copy Copilot agent hook scripts to .github/hooks/
  const hooksSrc = resolve(__dirname, 'hooks');
  for (const f of ['track-ai-edits.mjs', 'session-stop.mjs', 'session-start.mjs']) {
    const src = resolve(hooksSrc, f);
    if (existsSync(src)) copyFileSync(src, resolve(dotGithubHooks, f));
  }
  info(`Copied Copilot hook scripts → ${dotGithubHooks}`);

  // Copy git hook sources to .github/hooks/git/ (committed so the agent can install them)
  const scriptsSrc = resolve(__dirname, 'scripts');
  for (const f of ['prepare-commit-msg.mjs', 'post-commit.mjs']) {
    copyFileSync(resolve(scriptsSrc, f), resolve(gitSubdir, f));
  }
  info(`Copied git hook scripts → ${gitSubdir}`);

  // Install / update .github/hooks/hooks.json
  const hooksJsonPath = resolve(dotGithubHooks, 'hooks.json');
  const template      = JSON.parse(readFileSync(resolve(__dirname, 'copilot-hooks.json'), 'utf8'));

  if (!existsSync(hooksJsonPath)) {
    writeFileSync(hooksJsonPath, JSON.stringify(template, null, 2) + '\n');
    info(`Created Copilot hooks config → ${hooksJsonPath}`);
  } else {
    const existing = JSON.parse(readFileSync(hooksJsonPath, 'utf8'));
    const merged   = { ...template, hooks: { ...existing.hooks } };
    for (const [event, entries] of Object.entries(template.hooks)) {
      const prev = merged.hooks[event] ?? [];
      for (const entry of entries) {
        if (!prev.some(e => e.bash === entry.bash)) prev.push(entry);
      }
      merged.hooks[event] = prev;
    }
    writeFileSync(hooksJsonPath, JSON.stringify(merged, null, 2) + '\n');
    info(`Updated Copilot hooks config  → ${hooksJsonPath}`);
  }

  // Also install git hooks for the developer's local commits
  installGitHooks(projectDir, gitGlobal);
}

// ── Done ──────────────────────────────────────────────────────────────────────
console.log('');
console.log(`${GREEN}AI Co-Author Hook installed.${NC}`);
if (installCopilot) {
  warn('Commit .github/hooks/ to your repository so the Copilot agent can use the hooks.');
}

// ── Helper: install git hooks into .git/hooks/ ───────────────────────────────
function installGitHooks(dir, useGlobal) {
  const scriptsSrc = resolve(__dirname, 'scripts');

  function doInstall(hooksDir) {
    mkdirSync(hooksDir, { recursive: true });
    for (const hook of ['prepare-commit-msg', 'post-commit']) {
      const src  = resolve(scriptsSrc, `${hook}.mjs`);
      const dest = resolve(hooksDir, hook);

      if (existsSync(dest)) {
        const existing = readFileSync(dest, 'utf8');
        if (existing.includes('ai_session_files')) {
          warn(`Git hook already installed: ${dest} (skipping)`);
          continue;
        }
        warn(`Existing hook found: ${dest} → backed up to ${dest}.pre-ai`);
        copyFileSync(dest, `${dest}.pre-ai`);
      }

      copyFileSync(src, dest);
      try { chmodSync(dest, 0o755); } catch { /* Windows: chmod is a no-op */ }
      info(`Installed git hook → ${dest}`);
    }
  }

  if (useGlobal) {
    let templateDir;
    try {
      templateDir = execSync('git config --global init.templateDir', { encoding: 'utf8' }).trim();
    } catch {
      templateDir = resolve(os.homedir(), '.git-templates');
    }
    try { execSync(`git config --global init.templateDir "${templateDir}"`); } catch { /* ignore */ }
    doInstall(resolve(templateDir, 'hooks'));
    info(`Global git hook template → ${templateDir}`);
    warn(`Run 'git init' in existing repos to apply the template hooks.`);
  } else {
    let gitRoot;
    try {
      gitRoot = execSync(`git -C "${dir}" rev-parse --show-toplevel`, { encoding: 'utf8' }).trim();
    } catch {
      warn(`No git repository at ${dir} — skipping git hook installation.`);
      warn(`Run inside a git repo, or use --git-global for global installation.`);
      return;
    }
    doInstall(resolve(gitRoot, '.git', 'hooks'));
  }
}
