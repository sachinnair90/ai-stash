import { readLockfile } from '../lockfile/index.js';
import { getProjectRoot } from '../config/paths.js';

function getRoot(): string {
  return getProjectRoot(process.cwd()) ?? process.cwd();
}

export function handleListCommand(_args: string[]): void {
  const root = getRoot();
  const lockfile = readLockfile(root);

  if (!lockfile || Object.keys(lockfile.installed).length === 0) {
    console.log('no assets installed');
    process.exit(0);
  }

  const rows: Array<{ type: string; name: string; version: string; scope: string; registry: string }> = [];

  for (const [key, asset] of Object.entries(lockfile.installed)) {
    const parts = key.split(':');
    const registry = parts[0] ?? '';
    const name = parts.slice(2).join(':') || key;
    rows.push({
      type: asset.type,
      name,
      version: asset.version,
      scope: asset.scope,
      registry,
    });
  }

  // Calculate column widths
  const headers = { type: 'TYPE', name: 'NAME', version: 'VERSION', scope: 'SCOPE', registry: 'REGISTRY' };
  const widths = {
    type: Math.max(headers.type.length, ...rows.map((r) => r.type.length)),
    name: Math.max(headers.name.length, ...rows.map((r) => r.name.length)),
    version: Math.max(headers.version.length, ...rows.map((r) => r.version.length)),
    scope: Math.max(headers.scope.length, ...rows.map((r) => r.scope.length)),
    registry: Math.max(headers.registry.length, ...rows.map((r) => r.registry.length)),
  };

  function pad(s: string, w: number): string {
    return s.padEnd(w, ' ');
  }

  const gap = '  ';
  console.log(
    [
      pad(headers.type, widths.type),
      pad(headers.name, widths.name),
      pad(headers.version, widths.version),
      pad(headers.scope, widths.scope),
      pad(headers.registry, widths.registry),
    ].join(gap),
  );

  for (const row of rows) {
    console.log(
      [
        pad(row.type, widths.type),
        pad(row.name, widths.name),
        pad(row.version, widths.version),
        pad(row.scope, widths.scope),
        pad(row.registry, widths.registry),
      ].join(gap),
    );
  }
}
