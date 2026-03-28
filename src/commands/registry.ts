import fs from 'node:fs';
import path from 'node:path';
import { readLockfile, writeLockfile } from '../lockfile/index.js';
import { getProjectRoot } from '../config/paths.js';
import type { Lockfile, RegistryConfig } from '../lockfile/types.js';

function getRoot(): string {
  return getProjectRoot(process.cwd()) ?? process.cwd();
}

function loadOrInit(root: string): Lockfile {
  const existing = readLockfile(root);
  if (existing) return existing;
  return { version: 2, registries: [], installed: {} };
}

export function registryAdd(url: string, name: string): void {
  const root = getRoot();
  const lockfile = loadOrInit(root);

  // Validation: reject duplicate name or URL
  const dupName = lockfile.registries.find((r) => r.name === name);
  if (dupName) {
    console.error(`Error: a registry named "${name}" already exists (${dupName.url}).`);
    process.exit(1);
  }
  const dupUrl = lockfile.registries.find((r) => r.url === url);
  if (dupUrl) {
    console.error(`Error: registry URL "${url}" is already configured as "${dupUrl.name}".`);
    process.exit(1);
  }

  lockfile.registries.push({ name, url });
  writeLockfile(root, lockfile);
  console.log(`Registry "${name}" added (${url}).`);
}

export function registryRemove(name: string): void {
  const root = getRoot();
  const lockfile = loadOrInit(root);

  const idx = lockfile.registries.findIndex((r) => r.name === name);
  if (idx === -1) {
    console.error(`Error: no registry named "${name}" found.`);
    process.exit(1);
  }

  // Warn about orphaned assets
  const orphaned = Object.keys(lockfile.installed).filter((key) => {
    const parts = key.split(':');
    return parts[0] === name;
  });

  if (orphaned.length > 0) {
    console.warn(`Warning: ${orphaned.length} installed asset(s) will become orphaned:`);
    for (const key of orphaned) {
      console.warn(`  ${key}`);
    }
  }

  lockfile.registries.splice(idx, 1);
  writeLockfile(root, lockfile);
  console.log(`Registry "${name}" removed.`);
}

export function registryList(): void {
  const root = getRoot();
  const lockfile = readLockfile(root);

  if (!lockfile || lockfile.registries.length === 0) {
    console.log('No registries configured. Use: ai-stash registry add <url> --name <name>');
    return;
  }

  for (const reg of lockfile.registries) {
    const assetCount = Object.values(lockfile.installed).filter((asset, _, arr) => {
      // Count assets from this registry by matching lockfile keys
      return Object.keys(lockfile.installed).some(
        (key) => key.startsWith(`${reg.name}:`) && lockfile.installed[key] === asset,
      );
    }).length;
    const count = Object.keys(lockfile.installed).filter((k) => k.startsWith(`${reg.name}:`)).length;
    console.log(`  ${reg.name}  ${reg.url}  (${count} installed)`);
  }
}

export function handleRegistryCommand(args: string[]): void {
  const sub = args[0];

  if (sub === 'list') {
    registryList();
    return;
  }

  if (sub === 'add') {
    const url = args[1];
    if (!url) {
      console.error('Usage: ai-stash registry add <url> --name <name>');
      process.exit(1);
    }
    const nameFlag = args.indexOf('--name');
    const name = nameFlag >= 0 ? args[nameFlag + 1] : undefined;
    if (!name) {
      console.error('Usage: ai-stash registry add <url> --name <name>');
      process.exit(1);
    }
    registryAdd(url, name);
    return;
  }

  if (sub === 'remove') {
    const name = args[1];
    if (!name) {
      console.error('Usage: ai-stash registry remove <name>');
      process.exit(1);
    }
    registryRemove(name);
    return;
  }

  console.error(`Unknown registry subcommand: "${sub}"`);
  console.error('Available: registry add <url> --name <name> | registry remove <name> | registry list');
  process.exit(1);
}
