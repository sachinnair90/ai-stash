import { readLockfile } from '../lockfile/index.js';
import { getProjectRoot } from '../config/paths.js';
import { removeAssetFull } from '../engine/update.js';
import { parseTypeAndName } from './utils.js';

function getRoot(): string {
  return getProjectRoot(process.cwd()) ?? process.cwd();
}

export async function handleRemoveCommand(args: string[]): Promise<void> {
  const { type, name } = parseTypeAndName(args);

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
    await removeAssetFull(key, root, lockfile);
  }

  console.log(`Removed ${type} '${name}'`);
}
