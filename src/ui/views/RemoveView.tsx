import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { Lockfile } from '../../lockfile/types.js';
import { removeAsset } from '../../engine/update.js';

interface RemoveViewProps {
  assetName: string;
  lockfile: Lockfile;
  projectRoot: string;
  onDone: () => void;
  onCancel: () => void;
}

export function RemoveView({ assetName, lockfile, projectRoot, onDone, onCancel }: RemoveViewProps) {
  const asset = lockfile.installed[assetName];
  const [removing, setRemoving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptNotice, setScriptNotice] = useState<string | null>(null);

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    const result = await removeAsset(assetName, lockfile, projectRoot);
    setRemoving(false);
    if (result.success) {
      setDone(true);
      if (result.scriptNotice) {
        setScriptNotice(result.scriptNotice);
      }
    } else {
      setError(`Failed to remove "${assetName}". Check that the files are writable.`);
    }
  }, [assetName, lockfile, projectRoot]);

  useInput((input, key) => {
    if (done || error) {
      onDone();
      return;
    }
    if (key.escape || input === 'n' || input === 'N') {
      onCancel();
      return;
    }
    if (removing) return;
    if (!asset) return;
    if (input === 'y' || input === 'Y') void handleRemove();
  });

  if (!asset) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Asset &quot;{assetName}&quot; not found in lockfile.</Text>
        <Box marginTop={1}><Text dimColor>Escape or n to go back</Text></Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">{error}</Text>
        <Box marginTop={1}><Text dimColor>Press any key to go back</Text></Box>
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
      <Box padding={1} flexDirection="column">
        <Text color="green">Removed {assetName}. Press any key to continue.</Text>
        {scriptNotice && (
          <Box marginTop={1}>
            <Text color="yellow">{scriptNotice}</Text>
          </Box>
        )}
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
