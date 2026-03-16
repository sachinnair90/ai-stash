import React from 'react';
import { Box, Text } from 'ink';

interface KeyHint {
  key: string;
  label: string;
}

const hints: KeyHint[] = [
  { key: '/', label: 'search' },
  { key: 'i', label: 'install' },
  { key: 'u', label: 'updates' },
  { key: 'l', label: 'installed' },
  { key: '?', label: 'help' },
  { key: 'q', label: 'quit' },
];

export function Footer() {
  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      {hints.map((hint, idx) => (
        <Box key={hint.key} marginRight={2}>
          <Text bold color="cyan">{hint.key}</Text>
          <Text dimColor> {hint.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
