import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Lockfile } from '../../lockfile/types.js';

interface InstalledViewProps {
  lockfile: Lockfile | null;
  onRemove: (assetName: string) => void;
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
      const [name] = entries[selectedIndex];
      onRemove(name);
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
        {entries.map(([name, asset], index) => (
          <Box key={name}>
            <Text inverse={index === selectedIndex}>
              <Text> {name} </Text>
              <Text dimColor>v{asset.version} </Text>
              <Text color="cyan">{asset.scope} </Text>
              <Text dimColor>{asset.targets.join(', ')}</Text>
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}><Text dimColor>↑↓ navigate, r remove</Text></Box>
    </Box>
  );
}
