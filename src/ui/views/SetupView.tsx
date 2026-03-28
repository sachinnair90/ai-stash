import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { DEFAULT_CONFIG } from '../../config/types.js';

interface SetupViewProps {
  onDone: (registryUrl: string) => void;
}

export function SetupView({ onDone }: SetupViewProps) {
  const [url, setUrl] = useState(DEFAULT_CONFIG.registry.url);

  useInput((_input, key) => {
    if (key.return) {
      const trimmed = url.trim();
      if (trimmed) onDone(trimmed);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Welcome to ai-stash!</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>Enter the registry URL to fetch assets from.</Text>
        <Text dimColor>Press Enter to confirm.</Text>
      </Box>
      <Box marginTop={1}>
        <Text bold>Registry URL: </Text>
        <TextInput value={url} onChange={setUrl} />
      </Box>
    </Box>
  );
}
