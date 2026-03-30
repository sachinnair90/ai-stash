#!/usr/bin/env node
/**
 * specship post-install setup script
 *
 * Verifies Squad and OpenSpec CLIs at pinned versions, inits .squad/ and openspec/
 * if absent, and applies ceremony/routing patches idempotently.
 *
 * Run manually after installing specship:
 *   node <plugin-install-path>/scripts/setup.js
 *
 * Writes .setup-complete in the plugin directory on success.
 * Exits non-zero on failure — does NOT write .setup-complete if any step fails.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Pinned versions ──────────────────────────────────────────────────────────
const SQUAD_VERSION_RANGE = '0.9';     // matches 0.9.x
const OPENSPEC_VERSION_RANGE = '1.2';  // matches 1.2.x

// ── Paths ────────────────────────────────────────────────────────────────────
const PLUGIN_DIR = path.resolve(__dirname, '..');
const PROJECT_ROOT = process.cwd();
const SQUAD_DIR = path.join(PROJECT_ROOT, '.squad');
const OPENSPEC_DIR = path.join(PROJECT_ROOT, 'openspec');
const CEREMONIES_FILE = path.join(SQUAD_DIR, 'ceremonies.md');
const ROUTING_FILE = path.join(SQUAD_DIR, 'routing.md');
const TEAM_FILE = path.join(SQUAD_DIR, 'team.md');
const SETUP_COMPLETE = path.join(PLUGIN_DIR, '.setup-complete');

const CEREMONIES_PATCH = path.join(PLUGIN_DIR, 'patches', 'ceremonies-patch.md');
const ROUTING_PATCH = path.join(PLUGIN_DIR, 'patches', 'routing-patch.md');

const CEREMONY_SENTINEL = '# specship:spec-gate';
const ROUTING_SENTINEL = '# specship:speccer';

// ── Agent / skill source → dest pairs ────────────────────────────────────────
const SPECCER_SRC  = path.join(PLUGIN_DIR, '.squad', 'agents', 'speccer');
const SPECCER_DEST = path.join(SQUAD_DIR,  'agents', 'speccer');

const SKILL_PAIRS = [
  [
    path.join(PLUGIN_DIR, '.squad', 'skills', 'openspec'),
    path.join(SQUAD_DIR,  'skills', 'openspec'),
  ],
  [
    path.join(PLUGIN_DIR, '.squad', 'skills', 'openspec-scribe'),
    path.join(SQUAD_DIR,  'skills', 'openspec-scribe'),
  ],
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function run(cmd, { silent = false } = {}) {
  try {
    const out = execSync(cmd, { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' });
    return { ok: true, out: (out || '').trim() };
  } catch (err) {
    return { ok: false, out: (err.stdout || '').trim(), err: (err.stderr || '').trim() };
  }
}

function log(msg) { console.log(`  ${msg}`); }
function ok(msg)  { console.log(`  ✅ ${msg}`); }
function warn(msg){ console.log(`  ⚠️  ${msg}`); }
function fail(msg){ console.error(`  ❌ ${msg}`); }

function extractVersion(output) {
  const match = output.match(/(\d+\.\d+)/);
  return match ? match[1] : null;
}

// ── Step 1: Verify / install Squad ───────────────────────────────────────────
function checkSquad() {
  log('Checking Squad CLI...');
  const { ok: found, out } = run('squad --version', { silent: true });
  if (found) {
    const version = extractVersion(out);
    if (version && version.startsWith(SQUAD_VERSION_RANGE)) {
      ok(`Squad ${version} — pinned version satisfied`);
      return true;
    }
    warn(`Squad ${version || '?'} found but expected ${SQUAD_VERSION_RANGE}.x — reinstalling pinned version`);
  } else {
    log(`Squad not found — installing @bradygaster/squad-cli@${SQUAD_VERSION_RANGE}.x`);
  }

  const install = run(`npm install -g "@bradygaster/squad-cli@${SQUAD_VERSION_RANGE}"`);
  if (!install.ok) {
    fail(`Failed to install Squad: ${install.err}`);
    return false;
  }
  ok(`Squad installed at ${SQUAD_VERSION_RANGE}.x`);
  return true;
}

// ── Step 2: Verify / install OpenSpec ────────────────────────────────────────
function checkOpenSpec() {
  log('Checking OpenSpec CLI...');
  const { ok: found, out } = run('openspec --version', { silent: true });
  if (found) {
    const version = extractVersion(out);
    if (version && version.startsWith(OPENSPEC_VERSION_RANGE)) {
      ok(`OpenSpec ${version} — pinned version satisfied`);
      return true;
    }
    warn(`OpenSpec ${version || '?'} found but expected ${OPENSPEC_VERSION_RANGE}.x — reinstalling pinned version`);
  } else {
    log(`OpenSpec not found — installing openspec@${OPENSPEC_VERSION_RANGE}.x`);
  }

  const install = run(`npm install -g "openspec@${OPENSPEC_VERSION_RANGE}"`);
  if (!install.ok) {
    fail(`Failed to install OpenSpec: ${install.err}`);
    return false;
  }
  ok(`OpenSpec installed at ${OPENSPEC_VERSION_RANGE}.x`);
  return true;
}

// ── Step 3: Init .squad/ if absent ───────────────────────────────────────────
function initSquad() {
  if (fs.existsSync(SQUAD_DIR)) {
    ok('.squad/ already exists — skipping init');
    return true;
  }
  log('Initialising Squad (.squad/ not found)...');
  const result = run('squad init');
  if (!result.ok) {
    fail('squad init failed — create .squad/ manually or run `squad init` in your repo root');
    return false;
  }
  ok('.squad/ initialised');
  return true;
}

// ── Step 4: Init openspec/ if absent ─────────────────────────────────────────
function initOpenSpec() {
  if (fs.existsSync(OPENSPEC_DIR)) {
    ok('openspec/ already exists — skipping init');
    return true;
  }
  log('Initialising OpenSpec (openspec/ not found)...');
  const result = run('openspec init');
  if (!result.ok) {
    fail('openspec init failed — create openspec/ manually or run `openspec init` in your repo root');
    return false;
  }
  ok('openspec/ initialised');
  return true;
}

// ── Step 5: Apply ceremony patch (idempotent) ─────────────────────────────────
function applyCeremonyPatch() {
  log('Applying spec-gate ceremony patch...');

  if (!fs.existsSync(CEREMONIES_FILE)) {
    warn('.squad/ceremonies.md not found — creating it');
    fs.writeFileSync(CEREMONIES_FILE, '# Ceremonies\n\n', 'utf-8');
  }

  const existing = fs.readFileSync(CEREMONIES_FILE, 'utf-8');
  if (existing.includes(CEREMONY_SENTINEL)) {
    ok('spec-gate ceremony already present — skipping');
    return true;
  }

  const patch = fs.readFileSync(CEREMONIES_PATCH, 'utf-8');
  fs.appendFileSync(CEREMONIES_FILE, '\n' + patch + '\n', 'utf-8');
  ok('spec-gate ceremony appended to .squad/ceremonies.md');
  return true;
}

// ── Step 6: Apply routing patch (idempotent) ──────────────────────────────────
function applyRoutingPatch() {
  log('Applying Speccer routing patch...');

  if (!fs.existsSync(ROUTING_FILE)) {
    warn('.squad/routing.md not found — creating it');
    fs.writeFileSync(ROUTING_FILE, '# Routing\n\n', 'utf-8');
  }

  const existing = fs.readFileSync(ROUTING_FILE, 'utf-8');
  if (existing.includes(ROUTING_SENTINEL)) {
    ok('Speccer routing entry already present — skipping');
    return true;
  }

  const patch = fs.readFileSync(ROUTING_PATCH, 'utf-8');
  fs.appendFileSync(ROUTING_FILE, '\n' + patch + '\n', 'utf-8');
  ok('Speccer routing entry appended to .squad/routing.md');
  return true;
}

// ── Step 7: Copy Speccer agent files into .squad/agents/ (idempotent) ────────
function installSpeccerAgent() {
  log('Installing Speccer agent files...');

  if (fs.existsSync(SPECCER_DEST)) {
    ok('.squad/agents/speccer/ already exists — skipping');
    return true;
  }

  if (!fs.existsSync(SPECCER_SRC)) {
    fail(`Speccer source files not found at ${SPECCER_SRC}`);
    return false;
  }

  fs.mkdirSync(SPECCER_DEST, { recursive: true });
  for (const file of fs.readdirSync(SPECCER_SRC)) {
    fs.copyFileSync(path.join(SPECCER_SRC, file), path.join(SPECCER_DEST, file));
  }

  // Seed history.md placeholders with basic project context
  const historyFile = path.join(SPECCER_DEST, 'history.md');
  if (fs.existsSync(historyFile)) {
    const { out: gitUser } = run('git config user.name', { silent: true });
    const projectName = path.basename(PROJECT_ROOT);
    let history = fs.readFileSync(historyFile, 'utf-8');
    history = history
      .replace('{user name}', gitUser || 'Unknown')
      .replace('{project description}', projectName)
      .replace('{languages, frameworks, tools}', 'see package.json')
      .replace('{timestamp}', new Date().toISOString().slice(0, 10));
    fs.writeFileSync(historyFile, history, 'utf-8');
  }

  ok('Speccer agent files installed to .squad/agents/speccer/');
  return true;
}

// ── Step 8: Copy OpenSpec skills into .squad/skills/ (idempotent) ────────────
function installOpenSpecSkills() {
  log('Installing OpenSpec skills...');

  for (const [src, dest] of SKILL_PAIRS) {
    const skillName = path.basename(dest);
    if (fs.existsSync(dest)) {
      ok(`.squad/skills/${skillName}/ already exists — skipping`);
      continue;
    }
    if (!fs.existsSync(src)) {
      warn(`Skill source not found: ${src} — skipping`);
      continue;
    }
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      fs.copyFileSync(path.join(src, file), path.join(dest, file));
    }
    ok(`.squad/skills/${skillName}/ installed`);
  }

  return true;
}

// ── Step 9: Register Speccer in team.md (idempotent) ─────────────────────────
function registerSpeccerInTeam() {
  log('Registering Speccer in team.md...');

  if (!fs.existsSync(TEAM_FILE)) {
    warn('team.md not found — Speccer will not appear in the team roster');
    warn('This is non-fatal. Run `squad init` and re-run this script to register.');
    return true; // non-fatal: team.md may not exist when squad init hasn't run yet
  }

  const team = fs.readFileSync(TEAM_FILE, 'utf-8');
  if (team.toLowerCase().includes('speccer')) {
    ok('Speccer already listed in team.md — skipping');
    return true;
  }

  // Insert after the Members table header row (handles both separator styles)
  const MEMBERS_HEADER = /(\| *Name *\| *Role *\| *Charter *\| *Status *\|\n\|[-| ]+\|)/;
  const match = MEMBERS_HEADER.exec(team);
  if (match) {
    const entry = '\n| Speccer | Spec Lead | `.squad/agents/speccer/charter.md` | active |';
    const updated = team.slice(0, match.index + match[0].length) + entry + team.slice(match.index + match[0].length);
    fs.writeFileSync(TEAM_FILE, updated, 'utf-8');
  } else {
    // Fallback: append under ## Members if header parsing fails
    const updated = team.replace(/^(## Members\s*\n)/m, `$1\n| Speccer | Spec Lead | \`.squad/agents/speccer/charter.md\` | active |\n`);
    if (updated !== team) {
      fs.writeFileSync(TEAM_FILE, updated, 'utf-8');
    } else {
      warn('Could not locate ## Members in team.md — appending Speccer entry at end');
      fs.appendFileSync(TEAM_FILE, '\n| Speccer | Spec Lead | `.squad/agents/speccer/charter.md` | active |\n', 'utf-8');
    }
  }

  ok('Speccer registered in team.md');
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log('\nspecship setup\n' + '─'.repeat(40));

  const steps = [
    ['Verify Squad CLI',           checkSquad],
    ['Verify OpenSpec CLI',        checkOpenSpec],
    ['Init .squad/',               initSquad],
    ['Init openspec/',             initOpenSpec],
    ['Install Speccer agent',      installSpeccerAgent],
    ['Install OpenSpec skills',    installOpenSpecSkills],
    ['Apply ceremony patch',       applyCeremonyPatch],
    ['Apply routing patch',        applyRoutingPatch],
    ['Register Speccer in team',   registerSpeccerInTeam],
  ];

  for (const [label, fn] of steps) {
    console.log(`\n▶ ${label}`);
    if (!fn()) {
      console.error(`\nSetup failed at: ${label}`);
      console.error('Fix the issue above and re-run this script. It is safe to re-run — all steps are idempotent.');
      process.exit(1);
    }
  }

  fs.writeFileSync(SETUP_COMPLETE, new Date().toISOString() + '\n', 'utf-8');

  console.log('\n' + '─'.repeat(40));
  console.log('✅ specship setup complete\n');
  console.log('The Speccer is now on your Squad team.');
  console.log('Any "build X" or "add X" request will trigger the spec-gate ceremony automatically.\n');
}

main();
