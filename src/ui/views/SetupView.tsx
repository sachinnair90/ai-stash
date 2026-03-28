import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { RegistryConfig } from '../../lockfile/types.js';

const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/ai-stash/registry/main/registry.json';

interface SetupViewProps {
  onDone: (registries: RegistryConfig[]) => void;
}

type Step = 'url' | 'name' | 'review';

export function SetupView({ onDone }: SetupViewProps) {
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState(DEFAULT_REGISTRY_URL);
  const [name, setName] = useState('community');
  const [registries, setRegistries] = useState<RegistryConfig[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addCurrent = () => {
    const trimUrl = url.trim();
    const trimName = name.trim();
    if (!trimUrl || !trimName) { setError('Both URL and name are required'); return null; }
    if (registries.find((r) => r.name === trimName)) {
      setError(`Name "${trimName}" already used`); return null;
    }
    if (registries.find((r) => r.url === trimUrl)) {
      setError(`URL already added`); return null;
    }
    const reg: RegistryConfig = { name: trimName, url: trimUrl };
    setError(null);
    return reg;
  };

  useInput((_input, key) => {
    if (step === 'url') {
      if (key.return) {
        if (url.trim()) { setStep('name'); setError(null); }
        else setError('URL is required');
      }
      return;
    }

    if (step === 'name') {
      if (key.escape) { setStep('url'); setError(null); return; }
      if (key.return) {
        const reg = addCurrent();
        if (reg) {
          setRegistries((prev) => [...prev, reg]);
          setUrl('');
          setName('');
          setStep('review');
        }
        return;
      }
      return;
    }

    if (step === 'review') {
      if (_input === 'a') {
        setUrl(DEFAULT_REGISTRY_URL);
        setName('');
        setStep('url');
        return;
      }
      if (_input === 'd' && registries.length > 0) {
        setRegistries((prev) => prev.slice(0, -1));
        return;
      }
      if (key.return && registries.length > 0) {
        onDone(registries);
        return;
      }
      return;
    }
  });

  if (step === 'url') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Welcome to ai-stash!</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>Add your first registry URL.</Text>
          <Text dimColor>Press Enter to continue.</Text>
        </Box>
        <Box marginTop={1}>
          <Text bold>Registry URL: </Text>
          <TextInput value={url} onChange={setUrl} />
        </Box>
        {error && <Text color="red">{error}</Text>}
      </Box>
    );
  }

  if (step === 'name') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Name this registry</Text>
        <Text dimColor>{url}</Text>
        <Box marginTop={1}>
          <Text bold>Registry name: </Text>
          <TextInput value={name} onChange={setName} />
        </Box>
        {error && <Text color="red">{error}</Text>}
        <Box marginTop={1}><Text dimColor>Enter to add, Escape to go back</Text></Box>
      </Box>
    );
  }

  // review step
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Registries to configure:</Text>
      <Box marginTop={1} flexDirection="column">
        {registries.map((r) => (
          <Text key={r.name} color="green">  ✓ {r.name}  {r.url}</Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>a add another  d remove last  Enter confirm</Text>
      </Box>
      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}
