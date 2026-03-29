import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { Lockfile, RegistryConfig } from '../../lockfile/types.js';
import type { RegistryAsset } from '../../registry/types.js';
import { writeLockfile } from '../../lockfile/index.js';

interface RegistriesViewProps {
  lockfile: Lockfile | null;
  projectRoot: string;
  assets: RegistryAsset[];
  onDone: () => void;
  onCancel: () => void;
}

type Step = 'list' | 'add-url' | 'add-name' | 'confirm-remove';

export function RegistriesView({ lockfile, projectRoot, assets, onDone, onCancel }: RegistriesViewProps) {
  // Local copy of registries so add/remove stays in-view without kicking back to browse
  const [localRegistries, setLocalRegistries] = useState<RegistryConfig[]>(lockfile?.registries ?? []);
  const [step, setStep] = useState<Step>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const assetCountFor = (name: string) =>
    lockfile ? Object.keys(lockfile.installed).filter((k) => k.startsWith(`${name}:`)).length : 0;

  const handleAdd = useCallback(() => {
    if (!lockfile) return;
    const url = newUrl.trim();
    const name = newName.trim();
    if (!url || !name) { setError('URL and name are required'); return; }
    if (localRegistries.find((r) => r.name === name)) {
      setError(`Registry named "${name}" already exists`);
      return;
    }
    if (localRegistries.find((r) => r.url === url)) {
      setError(`Registry URL "${url}" already configured`);
      return;
    }
    const updated: Lockfile = { ...lockfile, registries: [...localRegistries, { name, url }] };
    writeLockfile(projectRoot, updated);
    setLocalRegistries(updated.registries);
    setNewUrl('');
    setNewName('');
    setError(null);
    setStep('list');
    // Stay in registries view — parent refreshes when user Escapes
  }, [lockfile, localRegistries, projectRoot, newUrl, newName]);

  const handleRemove = useCallback(() => {
    if (!lockfile) return;
    const reg = localRegistries[selectedIndex];
    if (!reg) return;
    const updated: Lockfile = {
      ...lockfile,
      registries: localRegistries.filter((r) => r.name !== reg.name),
    };
    writeLockfile(projectRoot, updated);
    setLocalRegistries(updated.registries);
    setSelectedIndex((i) => Math.min(i, Math.max(0, updated.registries.length - 1)));
    setStep('list');
    // Stay in registries view — parent refreshes when user Escapes
  }, [lockfile, localRegistries, projectRoot, selectedIndex]);

  useInput((input, key) => {
    if (step === 'list') {
      if (key.escape) { onDone(); return; }
      if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
      if (key.downArrow) setSelectedIndex((i) => Math.min(localRegistries.length - 1, i + 1));
      if (input === 'a') { setStep('add-url'); setError(null); return; }
      if (input === 'd' && localRegistries.length > 0) { setStep('confirm-remove'); return; }
      return;
    }

    if (step === 'add-url') {
      if (key.escape) { setStep('list'); setError(null); return; }
      if (key.return) {
        if (newUrl.trim()) setStep('add-name');
        else setError('URL is required');
        return;
      }
      return;
    }

    if (step === 'add-name') {
      if (key.escape) { setStep('add-url'); setError(null); return; }
      if (key.return) { handleAdd(); return; }
      return;
    }

    if (step === 'confirm-remove') {
      if (key.escape || input === 'n' || input === 'N') { setStep('list'); return; }
      if (input === 'y' || input === 'Y') { handleRemove(); return; }
      return;
    }
  });

  if (step === 'add-url') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Add Registry — URL</Text>
        <Box marginTop={1}>
          <Text>Registry URL: </Text>
          <TextInput value={newUrl} onChange={setNewUrl} />
        </Box>
        {error && <Text color="red">{error}</Text>}
        <Box marginTop={1}><Text dimColor>Enter to continue, Escape to cancel</Text></Box>
      </Box>
    );
  }

  if (step === 'add-name') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Add Registry — Name</Text>
        <Text dimColor>{newUrl}</Text>
        <Box marginTop={1}>
          <Text>Registry name: </Text>
          <TextInput value={newName} onChange={setNewName} />
        </Box>
        {error && <Text color="red">{error}</Text>}
        <Box marginTop={1}><Text dimColor>Enter to add, Escape to go back</Text></Box>
      </Box>
    );
  }

  if (step === 'confirm-remove') {
    const reg = localRegistries[selectedIndex];
    const count = reg ? assetCountFor(reg.name) : 0;
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="red">Remove registry "{reg?.name}"?</Text>
        <Text dimColor>{reg?.url}</Text>
        {count > 0 && (
          <Box marginTop={1}>
            <Text color="yellow">⚠ {count} installed asset(s) will become orphaned.</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text><Text bold>y</Text> confirm  <Text bold>n</Text>/Escape cancel</Text>
        </Box>
      </Box>
    );
  }

  // list view
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Registries</Text>
      <Box marginTop={1} flexDirection="column">
        {localRegistries.length === 0 ? (
          <Text dimColor>No registries configured. Press a to add one.</Text>
        ) : (
          localRegistries.map((reg, index) => (
            <Box key={reg.name}>
              <Text inverse={index === selectedIndex}>
                <Text> {reg.name} </Text>
                <Text dimColor>{reg.url} </Text>
                <Text dimColor>({assetCountFor(reg.name)} installed)</Text>
              </Text>
            </Box>
          ))
        )}
      </Box>
      <Box marginTop={1}><Text dimColor>↑↓ navigate, a add, d remove, Escape back</Text></Box>
    </Box>
  );
}
