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
const SETUP_COMPLETE = path.join(PLUGIN_DIR, '.setup-complete');

const CEREMONIES_PATCH = path.join(PLUGIN_DIR, 'patches', 'ceremonies-patch.md');
const ROUTING_PATCH = path.join(PLUGIN_DIR, 'patches', 'routing-patch.md');

const CEREMONY_SENTINEL = '# specship:spec-gate';
const ROUTING_SENTINEL = '# specship:speccer';

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

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log('\nspecship setup\n' + '─'.repeat(40));

  const steps = [
    ['Verify Squad CLI',          checkSquad],
    ['Verify OpenSpec CLI',       checkOpenSpec],
    ['Init .squad/',              initSquad],
    ['Init openspec/',            initOpenSpec],
    ['Apply ceremony patch',      applyCeremonyPatch],
    ['Apply routing patch',       applyRoutingPatch],
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
  console.log('Next step: add the Speccer to your Squad team.');
  console.log('Tell your Squad coordinator: "Add a Spec Lead to the team"');
  console.log('The coordinator will cast a name and seed the Speccer\'s history.\n');
}

main();
