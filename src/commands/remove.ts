import readline from 'node:readline';
import { readLockfile } from '../lockfile/index.js';
import { getProjectRoot } from '../config/paths.js';
import { removeAssetFull } from '../engine/update.js';
import { parseTypeAndName } from './utils.js';

function getRoot(): string {
  return getProjectRoot(process.cwd()) ?? process.cwd();
}

const INCOMPLETE_CLEANUP_WARNING = `⚠️  This asset was installed with scripts but has no postUninstall script.
   Script side effects (installed software, config files, etc.) cannot be
   cleaned up automatically. You may need to manually undo what the
   postInstall script did.`;

export async function handleRemoveCommand(args: string[]): Promise<void> {
  const { type, name } = parseTypeAndName(args);
  const force = args.includes('--force');

  const root = getRoot();
  const lockfile = readLockfile(root);

  if (!lockfile) {
    console.error(`Error: ${type} '${name}' is not installed`);
    process.exit(1);
  }

  // Find all lockfile keys matching type + name
  const matchingKeys = Object.entries(lockfile.installed)
    .filter(([key, entry]) => {
      const parts = key.split(':');
      return entry.type === type && parts.slice(2).join(':') === name;
    })
    .map(([key]) => key);

  if (matchingKeys.length === 0) {
    console.error(`Error: ${type} '${name}' is not installed`);
    process.exit(1);
  }

  if (matchingKeys.length > 1) {
    process.stderr.write(
      `Warning: found ${matchingKeys.length} entries for ${type} '${name}'. Removing all.\n`,
    );
  }

  for (const key of matchingKeys) {
    const entry = lockfile.installed[key];

    // Warn when riskAccepted but no postUninstall hash (tasks 8.1-8.4)
    if (entry?.riskAccepted && !entry.scriptHashes?.postUninstall) {
      process.stderr.write('\n' + INCOMPLETE_CLEANUP_WARNING + '\n\n');

      if (!force) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const confirmed = await new Promise<boolean>((resolve) => {
          rl.question('Continue with removal? [y/N]: ', (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase() === 'y');
          });
        });

        if (!confirmed) {
          console.error('Removal aborted.');
          process.exit(1);
        }
      }
    }

    const { scriptNotice } = await removeAssetFull(key, root, lockfile);
    if (scriptNotice) {
      process.stderr.write(scriptNotice);
    }
  }

  console.log(`Removed ${type} '${name}'`);
}
