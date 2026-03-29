import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import type { Lockfile, RegistryConfig } from '../lockfile/types.js';
import type { AssetType } from '../adapters/types.js';

export const KNOWN_ASSET_TYPES: AssetType[] = [
  'skill',
  'agent',
  'instruction',
  'hook',
  'command',
  'plugin',
  'mcp-server',
];

export function getGitHubToken(): string | undefined {
  if (process.env['GITHUB_TOKEN']) return process.env['GITHUB_TOKEN'];
  try {
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf-8' }).trim();
    if (token) return token;
  } catch { /* gh not installed or not authenticated */ }
  return undefined;
}

export function parseTypeAndName(args: string[]): { type: AssetType; name: string } {
  const type = args[0];
  const name = args[1];
  if (!type || !KNOWN_ASSET_TYPES.includes(type as AssetType)) {
    console.error(
      `Error: unknown asset type "${type ?? ''}". Known types: ${KNOWN_ASSET_TYPES.join(', ')}`,
    );
    process.exit(1);
  }
  if (!name || name.startsWith('--')) {
    console.error('Error: asset name is required');
    process.exit(1);
  }
  return { type: type as AssetType, name };
}

export async function resolveRegistry(
  args: string[],
  lockfile: Lockfile | null,
): Promise<RegistryConfig> {
  const registries = lockfile?.registries ?? [];

  const flagIdx = args.indexOf('--registry');
  if (flagIdx >= 0) {
    const registryName = args[flagIdx + 1];
    if (!registryName) {
      console.error('Error: --registry requires a name argument');
      process.exit(1);
    }
    const found = registries.find((r) => r.name === registryName);
    if (!found) {
      console.error(`Error: no registry named '${registryName}' configured`);
      process.exit(1);
    }
    return found;
  }

  if (registries.length === 0) {
    console.error(
      'Error: no registries configured. Run: ai-stash registry add <url> --name <name>',
    );
    process.exit(1);
  }

  if (registries.length === 1) {
    return registries[0];
  }

  // Multiple registries
  if (process.stdout.isTTY) {
    return promptRegistrySelection(registries);
  } else {
    process.stderr.write(
      `Warning: multiple registries configured, using '${registries[0].name}'. Use --registry to be explicit.\n`,
    );
    return registries[0];
  }
}

function promptRegistrySelection(registries: RegistryConfig[]): Promise<RegistryConfig> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('Select registry:');
    for (const [i, r] of registries.entries()) {
      console.log(`  ${i + 1}. ${r.name} (${r.url})`);
    }
    rl.question('Enter number [1]: ', (answer) => {
      rl.close();
      const num = parseInt(answer.trim() || '1', 10);
      resolve(registries[num - 1] ?? registries[0]);
    });
  });
}
