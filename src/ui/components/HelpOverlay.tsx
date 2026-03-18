import React from 'react';
import { Box, Text, useInput } from 'ink';

interface ShortcutGroup {
  title: string;
  shortcuts: { key: string; description: string }[];
}

const groups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { key: '↑↓', description: 'Navigate list' },
      { key: 'Enter', description: 'Select item' },
      { key: 'Space', description: 'Multi-select' },
      { key: 'Tab', description: 'Switch panes' },
    ],
  },
  {
    title: 'Search',
    shortcuts: [
      { key: '/', description: 'Open search' },
      { key: 'Escape', description: 'Clear search' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { key: 'i', description: 'Install selected' },
      { key: 'u', description: 'Open updates' },
      { key: 'l', description: 'List installed' },
      { key: 'r', description: 'Remove asset' },
      { key: 'q', description: 'Quit' },
      { key: '?', description: 'Toggle help' },
    ],
  },
];

interface HelpOverlayProps {
  onClose: () => void;
}

export function HelpOverlay({ onClose }: HelpOverlayProps) {
  useInput((input, key) => {
    if (input === '?' || key.escape) onClose();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Keyboard Shortcuts</Text>
        <Text dimColor>  (press ? or Escape to close)</Text>
      </Box>
      {groups.map((group) => (
        <Box key={group.title} flexDirection="column" marginBottom={1}>
          <Text bold underline>{group.title}</Text>
          {group.shortcuts.map((s) => (
            <Box key={s.key}>
              <Box width={12}>
                <Text bold color="yellow">{s.key}</Text>
              </Box>
              <Text>{s.description}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
