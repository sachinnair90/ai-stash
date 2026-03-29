import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { UserConfigEntry } from '../../registry/types.js';

interface UserConfigPromptProps {
  assetName: string;
  userConfig: Record<string, UserConfigEntry>;
  onComplete: (values: Record<string, string>) => void;
}

export function UserConfigPrompt({ assetName, userConfig, onComplete }: UserConfigPromptProps) {
  const entries = Object.entries(userConfig);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [currentValue, setCurrentValue] = useState('');

  const currentEntry = entries[currentIndex];

  const handleSubmit = useCallback(
    (value: string) => {
      if (!currentEntry) return;
      const [key] = currentEntry;
      const newValues = { ...values, [key]: value };
      setValues(newValues);
      setCurrentValue('');

      if (currentIndex + 1 >= entries.length) {
        onComplete(newValues);
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    },
    [currentEntry, currentIndex, entries.length, values, onComplete],
  );

  if (!currentEntry) return null;

  const [key, entry] = currentEntry;

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text bold color="cyan">
        Configure: {assetName} ({currentIndex + 1}/{entries.length})
      </Text>
      <Box marginTop={1}>
        <Text>
          {entry.description} [{key}]
          {entry.sensitive ? <Text color="yellow"> (sensitive - masked)</Text> : null}
          {': '}
        </Text>
        <TextInput
          value={currentValue}
          onChange={setCurrentValue}
          onSubmit={handleSubmit}
          mask={entry.sensitive ? '*' : undefined}
        />
      </Box>
    </Box>
  );
}
