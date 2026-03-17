import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { RegistryAsset } from '../../registry/types.js';
import type { Lockfile } from '../../lockfile/types.js';
import { getUnsyncedAssets } from '../../lockfile/index.js';
import { syncFromLockfile } from '../../engine/install.js';

interface SyncViewProps {
  lockfile: Lockfile | null;
  assets: RegistryAsset[];
  registryBaseUrl: string;
  projectRoot: string;
  onDone: () => void;
  githubToken?: string;
}

type Step = 'confirm' | 'syncing' | 'done';

export function SyncView({ lockfile, assets, registryBaseUrl, projectRoot, onDone, githubToken }: SyncViewProps) {
  const unsynced = lockfile ? getUnsyncedAssets(lockfile, projectRoot) : [];

  type AssetStatus = 'pending' | 'installing' | 'done' | 'skipped' | 'failed';
  const [step, setStep] = useState<Step>('confirm');
  const [statuses, setStatuses] = useState<Map<string, AssetStatus>>(
    new Map(unsynced.map(({ name }) => [name, 'pending']))
  );
  const [summary, setSummary] = useState<{ installed: string[]; skipped: string[]; failed: string[] } | null>(null);

  const runSync = useCallback(async () => {
    if (!lockfile) return;
    setStep('syncing');

    const result = await syncFromLockfile(
      lockfile,
      assets,
      projectRoot,
      registryBaseUrl,
      (name, status) => {
        setStatuses((prev) => new Map(prev).set(name, status));
      },
      githubToken,
    );

    setSummary(result);
    setStep('done');
  }, [lockfile, assets, projectRoot, registryBaseUrl, githubToken]);

  useInput((input, key) => {
    if (step === 'confirm') {
      if (input === 'y') void runSync();
      if (key.escape) onDone();
    }
    if (step === 'done') {
      if (key.escape || input === 'q' || input === '\r') onDone();
    }
  });

  if (unsynced.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Sync</Text>
        <Text color="green">✓ All assets are already installed.</Text>
        <Box marginTop={1}><Text dimColor>Escape to go back</Text></Box>
      </Box>
    );
  }

  if (step === 'confirm') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Sync from lockfile ({unsynced.length} missing)</Text>
        <Box marginTop={1} flexDirection="column">
          {unsynced.map(({ name, asset }) => (
            <Box key={name}>
              <Text dimColor>  </Text>
              <Text color="yellow">○ </Text>
              <Text>{name} </Text>
              <Text dimColor>v{asset.version} [{asset.scope}/{asset.targets.join(', ')}]</Text>
            </Box>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text>Install all {unsynced.length} missing assets? </Text>
          <Text bold color="cyan">y</Text>
          <Text> yes  </Text>
          <Text bold color="cyan">Escape</Text>
          <Text> cancel</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'syncing') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Syncing...</Text>
        <Box marginTop={1} flexDirection="column">
          {unsynced.map(({ name }) => {
            const status = statuses.get(name) ?? 'pending';
            return (
              <Box key={name}>
                {status === 'installing' && <><Spinner type="dots" /><Text> </Text></>}
                {status === 'done' && <Text color="green">✓ </Text>}
                {status === 'skipped' && <Text color="yellow">⚠ </Text>}
                {status === 'failed' && <Text color="red">✗ </Text>}
                {status === 'pending' && <Text dimColor>  </Text>}
                <Text dimColor={status === 'pending'}>{name}</Text>
                {status === 'skipped' && <Text dimColor> (not in registry)</Text>}
                {status === 'failed' && <Text dimColor> (failed)</Text>}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  }

  // done
  const installed = summary?.installed.length ?? 0;
  const skipped = summary?.skipped.length ?? 0;
  const failed = summary?.failed.length ?? 0;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Sync complete</Text>
      <Box marginTop={1} flexDirection="column">
        {unsynced.map(({ name }) => {
          const status = statuses.get(name) ?? 'pending';
          return (
            <Box key={name}>
              {status === 'done' && <Text color="green">✓ </Text>}
              {status === 'skipped' && <Text color="yellow">⚠ </Text>}
              {status === 'failed' && <Text color="red">✗ </Text>}
              <Text>{name}</Text>
              {status === 'skipped' && <Text dimColor> (not in registry — skipped)</Text>}
              {status === 'failed' && <Text dimColor> (install failed)</Text>}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color="green">{installed} installed</Text>
        {skipped > 0 && <Text color="yellow">  {skipped} skipped</Text>}
        {failed > 0 && <Text color="red">  {failed} failed</Text>}
      </Box>
      <Box marginTop={1}><Text dimColor>Escape to go back</Text></Box>
    </Box>
  );
}
