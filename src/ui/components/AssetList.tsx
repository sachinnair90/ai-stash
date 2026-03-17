import React from 'react';
import { Box, Text, useStdout } from 'ink';
import type { RegistryAsset } from '../../registry/types.js';
import type { Lockfile } from '../../lockfile/types.js';
import { isInstalled, isUpdateAvailable } from '../../lockfile/index.js';

const typeColors: Record<string, string> = {
  skill: 'green',
  agent: 'blue',
  instruction: 'yellow',
  hook: 'red',
  command: 'magenta',
  plugin: 'cyan',
  'mcp-server': 'yellowBright',
};

interface AssetListProps {
  assets: RegistryAsset[];
  selectedIndex: number;
  selectedItems: Set<string>;
  lockfile: Lockfile | null;
  onSelect: (index: number) => void;
  onToggle: (name: string) => void;
}

// Lines consumed by header, search bar, footer, and borders
const CHROME_LINES = 8;

export function AssetList({
  assets,
  selectedIndex,
  selectedItems,
  lockfile,
  onSelect,
  onToggle,
}: AssetListProps) {
  const { stdout } = useStdout();
  const terminalRows = stdout.rows ?? 24;
  const maxVisible = Math.max(3, terminalRows - CHROME_LINES);

  if (assets.length === 0) {
    return (
      <Box padding={1}>
        <Text dimColor>No assets found.</Text>
      </Box>
    );
  }

  // Keep selected item in the visible window
  const windowStart = Math.max(
    0,
    Math.min(selectedIndex - Math.floor(maxVisible / 2), assets.length - maxVisible),
  );
  const visibleAssets = assets.slice(windowStart, windowStart + maxVisible);

  return (
    <Box flexDirection="column">
      {visibleAssets.map((asset, i) => {
        const index = windowStart + i;
        const isSelected = index === selectedIndex;
        const isMultiSelected = selectedItems.has(asset.name);
        const installed = isInstalled(lockfile, asset.name);
        const hasUpdate = isUpdateAvailable(lockfile, asset.name, asset.version);

        const color = typeColors[asset.type] ?? 'white';

        let statusIcon = '  ';
        if (installed && hasUpdate) {
          statusIcon = '↑ ';
        } else if (installed) {
          statusIcon = '● ';
        }

        let statusColor = 'white';
        if (installed && hasUpdate) {
          statusColor = 'yellow';
        } else if (installed) {
          statusColor = 'green';
        }

        const checkbox = isMultiSelected ? '[×] ' : '[ ] ';
        const description = asset.description.length > 50
          ? asset.description.slice(0, 47) + '...'
          : asset.description;

        return (
          <Box key={`${asset.type}-${asset.name}`}>
            <Text inverse={isSelected}>
              <Text>{checkbox}</Text>
              <Text color={statusColor}>{statusIcon}</Text>
              <Text color={color} bold>[{asset.type}]</Text>
              <Text> {asset.name} </Text>
              <Text dimColor>{description} </Text>
              <Text color="green">v{asset.version}</Text>
            </Text>
          </Box>
        );
        })}
    </Box>
  );
}
