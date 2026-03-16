import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { AssetType } from '../hooks/useFilter.js';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  isActive: boolean;
  typeFilter: AssetType | null;
  targetFilter: string | null;
}

export function SearchBar({
  value,
  onChange,
  isActive,
  typeFilter,
  targetFilter,
}: SearchBarProps) {
  return (
    <Box>
      <Text bold color="cyan">/</Text>
      <Text> </Text>
      {isActive ? (
        <TextInput value={value} onChange={onChange} placeholder="Search assets..." />
      ) : (
        <Text dimColor>{value || 'Search assets...'}</Text>
      )}
      {typeFilter && (
        <Box marginLeft={1}>
          <Text color="yellow" bold>[type:{typeFilter}]</Text>
        </Box>
      )}
      {targetFilter && (
        <Box marginLeft={1}>
          <Text color="green" bold>[target:{targetFilter}]</Text>
        </Box>
      )}
    </Box>
  );
}
