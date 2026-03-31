#!/usr/bin/env node
/**
 * specship post-uninstall cleanup script
 *
 * Removes the spec-gate ceremony and Speccer routing entries appended by setup.js,
 * archives the Speccer agent folder (preserves history), and removes .setup-complete.
 *
 * Run manually after uninstalling specship:
 *   node <plugin-install-path>/scripts/cleanup.js
 *
 * All steps are safe to re-run. If a sentinel is not found, the step is skipped.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Paths ────────────────────────────────────────────────────────────────────
const PLUGIN_DIR = path.resolve(__dirname, '..');
const PROJECT_ROOT = process.cwd();
const SQUAD_DIR = path.join(PROJECT_ROOT, '.squad');
const CEREMONIES_FILE = path.join(SQUAD_DIR, 'ceremonies.md');
const ROUTING_FILE = path.join(SQUAD_DIR, 'routing.md');
const TEAM_FILE = path.join(SQUAD_DIR, 'team.md');
const SPECCER_DIR = path.join(SQUAD_DIR, 'agents', 'speccer');
const ALUMNI_DIR = path.join(SQUAD_DIR, 'agents', '_alumni', 'speccer');
const SETUP_COMPLETE = path.join(PLUGIN_DIR, '.setup-complete');

const CEREMONY_START = '<!-- specship:spec-gate';
const CEREMONY_END   = '<!-- /specship:spec-gate -->';
const ROUTING_START  = '<!-- specship:speccer';
const ROUTING_END    = '<!-- /specship:speccer -->';

// ── Helpers ──────────────────────────────────────────────────────────────────
function ok(msg)  { console.log(`  ✅ ${msg}`); }
function warn(msg){ console.log(`  ⚠️  ${msg}`); }
function log(msg) { console.log(`  ${msg}`); }

/**
 * Remove the block between startSentinel and endSentinel (inclusive) from a file.
 * Idempotent: if sentinels not found, file is unchanged.
 */
function removeSentinelBlock(filePath, startSentinel, endSentinel, label) {
  if (!fs.existsSync(filePath)) {
    warn(`${filePath} not found — skipping ${label} removal`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const startIdx = content.indexOf(startSentinel);
  if (startIdx === -1) {
    ok(`${label} sentinel not found in ${path.basename(filePath)} — already clean`);
    return;
  }

  const endIdx = content.indexOf(endSentinel, startIdx);
  if (endIdx === -1) {
    warn(`${label} start sentinel found but end sentinel missing in ${path.basename(filePath)} — removing from start sentinel to end of file`);
    const cleaned = content.slice(0, startIdx).trimEnd() + '\n';
    fs.writeFileSync(filePath, cleaned, 'utf-8');
    ok(`${label} block removed (partial — no end sentinel)`);
    return;
  }

  // Remove from just before startSentinel (including any leading newline) through endSentinel line
  const before = content.slice(0, startIdx).replace(/\n+$/, '\n');
  const after = content.slice(endIdx + endSentinel.length).replace(/^\n+/, '\n');
  fs.writeFileSync(filePath, before + after, 'utf-8');
  ok(`${label} block removed from ${path.basename(filePath)}`);
}

// ── Step 1: Remove ceremony patch ────────────────────────────────────────────
function removeCeremonyPatch() {
  log('Removing spec-gate ceremony patch...');
  removeSentinelBlock(CEREMONIES_FILE, CEREMONY_START, CEREMONY_END, 'spec-gate ceremony');
}

// ── Step 2: Remove routing patch ─────────────────────────────────────────────
function removeRoutingPatch() {
  log('Removing Speccer routing patch...');
  removeSentinelBlock(ROUTING_FILE, ROUTING_START, ROUTING_END, 'Speccer routing');
}

// ── Step 3: Archive Speccer agent folder ─────────────────────────────────────
function archiveSpeccer() {
  log('Archiving Speccer agent...');

  if (!fs.existsSync(SPECCER_DIR)) {
    ok('.squad/agents/speccer/ not found — nothing to archive');
    return;
  }

  if (fs.existsSync(ALUMNI_DIR)) {
    warn('.squad/agents/_alumni/speccer/ already exists — Speccer may have been archived previously');
    ok('Skipping archive to avoid overwriting existing alumni entry');
    return;
  }

  fs.mkdirSync(path.dirname(ALUMNI_DIR), { recursive: true });
  fs.renameSync(SPECCER_DIR, ALUMNI_DIR);
  ok('Speccer archived to .squad/agents/_alumni/speccer/ (history preserved)');
}

// ── Step 4: Remove Speccer from team.md ──────────────────────────────────────
function deregisterSpeccerFromTeam() {
  log('Removing Speccer from team.md...');

  if (!fs.existsSync(TEAM_FILE)) {
    ok('team.md not found — nothing to remove');
    return;
  }

  const content = fs.readFileSync(TEAM_FILE, 'utf-8');
  // Remove the line that contains the Speccer entry in the Members table
  const updated = content.split('\n').filter(line => !/^\|\s*Speccer\s*\|/i.test(line)).join('\n');
  if (updated !== content) {
    fs.writeFileSync(TEAM_FILE, updated, 'utf-8');
    ok('Speccer removed from team.md');
  } else {
    ok('Speccer not found in team.md — already clean');
  }
}

// ── Step 5: Remove .setup-complete ───────────────────────────────────────────
function removeSetupComplete() {
  log('Removing .setup-complete...');
  if (fs.existsSync(SETUP_COMPLETE)) {
    fs.unlinkSync(SETUP_COMPLETE);
    ok('.setup-complete removed');
  } else {
    ok('.setup-complete not found — already clean');
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log('\nspecship cleanup\n' + '─'.repeat(40));

  const steps = [
    ['Remove ceremony patch',        removeCeremonyPatch],
    ['Remove routing patch',         removeRoutingPatch],
    ['Archive Speccer agent',        archiveSpeccer],
    ['Deregister Speccer from team', deregisterSpeccerFromTeam],
    ['Remove .setup-complete',       removeSetupComplete],
  ];

  for (const [label, fn] of steps) {
    console.log(`\n▶ ${label}`);
    fn();
  }

  console.log('\n' + '─'.repeat(40));
  console.log('✅ specship cleanup complete\n');
  console.log('Note: Squad and OpenSpec CLIs were NOT uninstalled (they may be used by other tools).');
  console.log('Note: openspec/ directory was NOT removed (may contain your spec artifacts).');
  console.log('      Remove it manually if no longer needed.\n');
}

main();
