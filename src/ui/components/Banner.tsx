import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../../../package.json') as { version: string; description: string };

const VERSION = pkg.version;
const DESCRIPTION = pkg.description;

const LOGO = [
  '   █████████   █████             █████████  ███████████   █████████    █████████  █████   █████',
  '  ███▒▒▒▒▒███ ▒▒███             ███▒▒▒▒▒███▒█▒▒▒███▒▒▒█  ███▒▒▒▒▒███  ███▒▒▒▒▒███▒▒███   ▒▒███',
  ' ▒███    ▒███  ▒███            ▒███    ▒▒▒ ▒   ▒███  ▒  ▒███    ▒███ ▒███    ▒▒▒  ▒███    ▒███',
  ' ▒███████████  ▒███  ██████████▒▒█████████     ▒███     ▒███████████ ▒▒█████████  ▒███████████',
  ' ▒███▒▒▒▒▒███  ▒███ ▒▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒███    ▒███     ▒███▒▒▒▒▒███  ▒▒▒▒▒▒▒▒███ ▒███▒▒▒▒▒███',
  ' ▒███    ▒███  ▒███             ███    ▒███    ▒███     ▒███    ▒███  ███    ▒███ ▒███    ▒███',
  ' █████   █████ █████           ▒▒█████████     █████    █████   █████▒▒█████████  █████   █████',
  '▒▒▒▒▒   ▒▒▒▒▒ ▒▒▒▒▒             ▒▒▒▒▒▒▒▒▒     ▒▒▒▒▒    ▒▒▒▒▒   ▒▒▒▒▒  ▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒   ▒▒▒▒▒',
];

const TYPING_DURATION_MS = 800;

interface BannerProps {
  onDone: () => void;
}

export function Banner({ onDone }: BannerProps) {
  const [charCount, setCharCount] = useState(0);

  const intervalMs = Math.max(16, Math.floor(TYPING_DURATION_MS / DESCRIPTION.length));

  useEffect(() => {
    if (charCount >= DESCRIPTION.length) {
      onDone();
      return;
    }

    const interval = setInterval(() => {
      setCharCount(prev => Math.min(prev + 1, DESCRIPTION.length));
    }, intervalMs);

    return () => clearInterval(interval);
  }, [charCount, onDone, intervalMs]);

  const visibleText = DESCRIPTION.slice(0, charCount);
  const cursor = charCount < DESCRIPTION.length ? '▌' : '';

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      paddingY={1}
    >
      <Box flexDirection="column" alignItems="flex-start">
        {LOGO.map((line, i) => (
          <Text key={i} color="cyan" bold>{line}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>v{VERSION}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>{visibleText}<Text color="cyan">{cursor}</Text></Text>
      </Box>
    </Box>
  );
}
