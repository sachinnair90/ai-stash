import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { RegistryAsset } from '../../registry/types.js';
import type { Lockfile } from '../../lockfile/types.js';
import { isUpdateAvailable, getInstalledVersion } from '../../lockfile/index.js';
import { updateAsset, updateAll, type UpdateResult } from '../../engine/update.js';

interface UpdateViewProps {
  assets: RegistryAsset[];
  lockfile: Lockfile | null;
  registryBaseUrl: string;
  projectRoot: string;
  onDone: () => void;
  githubToken?: string;
}

export function UpdateView({ assets, lockfile, registryBaseUrl, projectRoot, onDone, githubToken }: UpdateViewProps) {
  const updatable = assets.filter((a) => isUpdateAvailable(lockfile, a.name, a.version));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [updating, setUpdating] = useState(false);

  // Clamp selectedIndex when updatable shrinks (e.g. after a successful update)
  useEffect(() => {
    if (updatable.length > 0) {
      setSelectedIndex((i) => Math.min(updatable.length - 1, Math.max(0, i)));
    }
  }, [updatable.length]);
  const [results, setResults] = useState<UpdateResult[]>([]);

  const handleUpdateOne = useCallback(async () => {
    if (!lockfile || updatable.length === 0) return;
    setUpdating(true);
    const asset = updatable[selectedIndex];
    const result = await updateAsset(asset, lockfile, projectRoot, registryBaseUrl, githubToken);
    setResults((prev) => [...prev, result]);
    setUpdating(false);
  }, [lockfile, updatable, selectedIndex, registryBaseUrl, projectRoot, githubToken]);

  const handleUpdateAll = useCallback(async () => {
    if (!lockfile || updatable.length === 0) return;
    setUpdating(true);
    const allResults = await updateAll(updatable, lockfile, projectRoot, registryBaseUrl, githubToken);
    setResults(allResults);
    setUpdating(false);
  }, [lockfile, updatable, registryBaseUrl, projectRoot, githubToken]);

  useInput((input, key) => {
    if (key.escape) {
      onDone();
      return;
    }
    if (key.upArrow && updatable.length > 0) setSelectedIndex((i) => Math.max(0, i - 1));
    if (key.downArrow && updatable.length > 0) setSelectedIndex((i) => Math.min(updatable.length - 1, i + 1));
    if (input === 'u' && !updating) void handleUpdateOne();
    if (input === 'U' && !updating) void handleUpdateAll();
  });

  if (updatable.length === 0) {
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
      <Text bold>Available Updates ({updatable.length})</Text>
      {updating && (
        <Box>
          <Spinner type="dots" />
          <Text> Updating...</Text>
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        {updatable.map((asset, index) => {
          const installed = getInstalledVersion(lockfile, asset.name) ?? '?';
          const wasUpdated = results.some((r) => r.asset === asset.name && r.success);
          return (
            <Box key={asset.name}>
              <Text inverse={index === selectedIndex}>
                {wasUpdated ? (
                  <Text color="green">✓ </Text>
                ) : (
                  <Text color="yellow">↑ </Text>
                )}
                <Text>{asset.name} </Text>
                <Text dimColor>{installed} → {asset.version}</Text>
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}><Text dimColor>u update selected, U update all, Escape back</Text></Box>
    </Box>
  );
}
