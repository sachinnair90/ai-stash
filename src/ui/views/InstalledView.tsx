import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Lockfile } from '../../lockfile/types.js';

interface InstalledViewProps {
  lockfile: Lockfile | null;
  onRemove: (lockfileKey: string) => void;
}

function isOrphaned(lockfileKey: string, lockfile: Lockfile): boolean {
  const parts = lockfileKey.split(':');
  if (parts.length < 3) return false;
  const registryName = parts[0];
  return !lockfile.registries.some((r) => r.name === registryName);
}

function displayName(lockfileKey: string): string {
  const parts = lockfileKey.split(':');
  if (parts.length >= 3) return parts.slice(2).join(':');
  return lockfileKey;
}

function registryNameFrom(lockfileKey: string): string {
  return lockfileKey.split(':')[0] ?? lockfileKey;
}

export function InstalledView({ lockfile, onRemove }: InstalledViewProps) {
  const entries = lockfile ? Object.entries(lockfile.installed) : [];
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow && entries.length > 0) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    }
    if (key.downArrow && entries.length > 0) {
      setSelectedIndex((i) => Math.min(entries.length - 1, i + 1));
    }
    if (input === 'r' && entries.length > 0) {
      const [lockfileKey] = entries[selectedIndex];
      onRemove(lockfileKey);
    }
  });

  if (entries.length === 0) {
    return (
      <Box padding={1}>
        <Text dimColor>No installed assets.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Installed Assets</Text>
      <Box marginTop={1} flexDirection="column">
        {entries.map(([lockfileKey, asset], index) => {
          const orphaned = lockfile ? isOrphaned(lockfileKey, lockfile) : false;
          const regName = registryNameFrom(lockfileKey);
          const name = displayName(lockfileKey);
          return (
            <Box key={lockfileKey}>
              <Text inverse={index === selectedIndex}>
                {orphaned && <Text color="yellow">⚠ </Text>}
                <Text> {name} </Text>
                <Text dimColor>v{asset.version} </Text>
                <Text color="cyan">{asset.scope} </Text>
                <Text dimColor>{asset.targets.join(', ')}</Text>
                {orphaned && <Text color="yellow"> — registry '{regName}' not configured</Text>}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}><Text dimColor>↑↓ navigate, r remove</Text></Box>
    </Box>
  );
}
