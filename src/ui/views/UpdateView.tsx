import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { RegistryAsset } from '../../registry/types.js';
import type { Lockfile } from '../../lockfile/types.js';
import { checkUpdates, updateAsset, updateAll, type UpdateResult, type UpdateCheck } from '../../engine/update.js';

interface UpdateViewProps {
  assets: RegistryAsset[];
  lockfile: Lockfile | null;
  projectRoot: string;
  onDone: () => void;
  githubToken?: string;
}

export function UpdateView({ assets, lockfile, projectRoot, onDone, githubToken }: UpdateViewProps) {
  const updates = checkUpdates(lockfile, assets);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (updates.length > 0) {
      setSelectedIndex((i) => Math.min(updates.length - 1, Math.max(0, i)));
    }
  }, [updates.length]);
  const [results, setResults] = useState<UpdateResult[]>([]);

  const handleUpdateOne = useCallback(async () => {
    if (!lockfile || updates.length === 0) return;
    setUpdating(true);
    const update = updates[selectedIndex];
    const asset = assets.find((a) => a.name === update.name && a.registryName === update.lockfileKey.split(':')[0]);
    if (!asset) { setUpdating(false); return; }
    const result = await updateAsset(asset, update.lockfileKey, lockfile, projectRoot, githubToken);
    setResults((prev) => [...prev, result]);
    setUpdating(false);
  }, [lockfile, updates, selectedIndex, projectRoot, githubToken, assets]);

  const handleUpdateAll = useCallback(async () => {
    if (!lockfile || updates.length === 0) return;
    setUpdating(true);
    const allResults = await updateAll(updates, assets, lockfile, projectRoot, githubToken);
    setResults(allResults);
    setUpdating(false);
  }, [lockfile, updates, assets, projectRoot, githubToken]);

  useInput((input, key) => {
    if (key.escape) {
      onDone();
      return;
    }
    if (key.upArrow && updates.length > 0) setSelectedIndex((i) => Math.max(0, i - 1));
    if (key.downArrow && updates.length > 0) setSelectedIndex((i) => Math.min(updates.length - 1, i + 1));
    if (input === 'u' && !updating) void handleUpdateOne();
    if (input === 'U' && !updating) void handleUpdateAll();
  });

  if (updates.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Updates</Text>
        <Text dimColor>All assets are up to date.</Text>
        <Box marginTop={1}><Text dimColor>Escape to go back</Text></Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Available Updates ({updates.length})</Text>
      {updating && (
        <Box>
          <Spinner type="dots" />
          <Text> Updating...</Text>
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        {updates.map((update, index) => {
          const wasUpdated = results.some((r) => r.asset === update.name && r.success);
          return (
            <Box key={update.lockfileKey}>
              <Text inverse={index === selectedIndex}>
                {wasUpdated ? (
                  <Text color="green">✓ </Text>
                ) : (
                  <Text color="yellow">↑ </Text>
                )}
                <Text>{update.name} </Text>
                <Text dimColor>{update.installedVersion} → {update.latestVersion}</Text>
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}><Text dimColor>u update selected, U update all, Escape back</Text></Box>
    </Box>
  );
}
