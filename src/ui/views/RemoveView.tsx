import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { Lockfile } from '../../lockfile/types.js';
import { removeAsset } from '../../engine/update.js';

interface RemoveViewProps {
  assetName: string;
  lockfile: Lockfile;
  onDone: () => void;
  onCancel: () => void;
}

export function RemoveView({ assetName, lockfile, onDone, onCancel }: RemoveViewProps) {
  const asset = lockfile.installed[assetName];
  const [removing, setRemoving] = useState(false);
  const [done, setDone] = useState(false);

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    await removeAsset(assetName, lockfile, process.cwd());
    setRemoving(false);
    setDone(true);
  }, [assetName, lockfile]);

  useInput((input, key) => {
    if (done) {
      onDone();
      return;
    }
    if (removing) return;
    if (input === 'y' || input === 'Y') void handleRemove();
    if (input === 'n' || input === 'N' || key.escape) onCancel();
  });

  if (!asset) {
    return (
      <Box padding={1}>
        <Text color="red">Asset &quot;{assetName}&quot; not found in lockfile.</Text>
      </Box>
    );
  }

  if (removing) {
    return (
      <Box padding={1}>
        <Spinner type="dots" />
        <Text> Removing {assetName}...</Text>
      </Box>
    );
  }

  if (done) {
    return (
      <Box padding={1}>
        <Text color="green">Removed {assetName}. Press any key to continue.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="red">Remove {assetName}?</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>The following files will be deleted:</Text>
        {asset.files.map((f) => (
          <Text key={f} dimColor>  {f}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text><Text bold>y</Text> confirm  <Text bold>n</Text>/Escape cancel</Text>
      </Box>
    </Box>
  );
}
