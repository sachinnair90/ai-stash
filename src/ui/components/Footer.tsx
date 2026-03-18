import React from 'react';
import { Box, Text } from 'ink';

interface FooterProps {
  unsyncedCount?: number;
}

export function Footer({ unsyncedCount }: FooterProps) {
  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Box marginRight={2}><Text bold color="cyan">/</Text><Text dimColor> search</Text></Box>
      <Box marginRight={2}><Text bold color="cyan">i</Text><Text dimColor> install</Text></Box>
      <Box marginRight={2}><Text bold color="cyan">u</Text><Text dimColor> updates</Text></Box>
      <Box marginRight={2}><Text bold color="cyan">l</Text><Text dimColor> installed</Text></Box>
      {unsyncedCount !== undefined && unsyncedCount > 0 && (
        <Box marginRight={2}>
          <Text bold color="yellow">s</Text>
          <Text dimColor> sync </Text>
          <Text color="yellow">({unsyncedCount})</Text>
        </Box>
      )}
      <Box marginRight={2}><Text bold color="cyan">?</Text><Text dimColor> help</Text></Box>
      <Box marginRight={2}><Text bold color="cyan">q</Text><Text dimColor> quit</Text></Box>
    </Box>
  );
}
