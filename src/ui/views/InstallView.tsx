import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { RegistryAsset } from '../../registry/types.js';
import { installAsset, type InstallFileStatus } from '../../engine/install.js';

type Step = 'scope' | 'targets' | 'progress' | 'conflict' | 'done';

interface InstallViewProps {
  assets: RegistryAsset[];
  onDone: () => void;
  onCancel: () => void;
  registryBaseUrl: string;
  registryName: string;
  projectRoot: string;
  githubToken?: string;
}

const scopes = ['project', 'global'] as const;
const targetOptions = ['claude-code', 'copilot'] as const;

interface SuffixNotice {
  originalName: string;
  suffixedName: string;
  conflictingRegistry: string;
}

export function InstallView({ assets, onDone, onCancel, registryBaseUrl, registryName, projectRoot, githubToken }: InstallViewProps) {
  const [step, setStep] = useState<Step>('scope');
  const [scopeIndex, setScopeIndex] = useState(0);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set(['claude-code']));
  const [targetIndex, setTargetIndex] = useState(0);
  const [results, setResults] = useState<Map<string, InstallFileStatus[]>>(new Map());
  const [installing, setInstalling] = useState(false);
  const [conflictFile, setConflictFile] = useState<string | null>(null);
  const [suffixNotices, setSuffixNotices] = useState<SuffixNotice[]>([]);
  const [scriptNotices, setScriptNotices] = useState<string[]>([]);

  const runInstall = useCallback(async () => {
    setStep('progress');
    setInstalling(true);

    for (const asset of assets) {
      const fileStatuses: InstallFileStatus[] = asset.files.map((f) => ({
        file: f,
        status: 'pending' as const,
      }));
      setResults((prev) => new Map(prev).set(asset.name, fileStatuses));

      const result = await installAsset(asset, {
        scope: scopes[scopeIndex],
        targets: Array.from(selectedTargets),
        projectRoot,
        registryBaseUrl,
        registryName,
        githubToken,
      }, (status) => {
        setResults((prev) => {
          const next = new Map(prev);
          const files = next.get(asset.name) ?? [];
          const idx = files.findIndex((f) => f.file === status.file);
          if (idx >= 0) {
            files[idx] = status;
          }
          next.set(asset.name, [...files]);
          return next;
        });

        if (status.status === 'conflict') {
          setConflictFile(status.file);
          setStep('conflict');
        }
      });

      if (result.suffixApplied) {
        setSuffixNotices((prev) => [...prev, result.suffixApplied!]);
      }

      if (result.scriptNotice) {
        setScriptNotices((prev) => [...prev, result.scriptNotice!]);
      }

      setResults((prev) => {
        const next = new Map(prev);
        next.set(asset.name, result.files);
        return next;
      });
    }

    setInstalling(false);
    setStep('done');
  }, [assets, scopeIndex, selectedTargets, registryBaseUrl, registryName, projectRoot, githubToken]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (step === 'scope') {
      if (key.upArrow) setScopeIndex((i) => Math.max(0, i - 1));
      if (key.downArrow) setScopeIndex((i) => Math.min(scopes.length - 1, i + 1));
      if (key.return) setStep('targets');
      return;
    }

    if (step === 'targets') {
      if (key.upArrow) setTargetIndex((i) => Math.max(0, i - 1));
      if (key.downArrow) setTargetIndex((i) => Math.min(targetOptions.length - 1, i + 1));
      if (input === ' ') {
        const target = targetOptions[targetIndex];
        setSelectedTargets((prev) => {
          const next = new Set(prev);
          if (next.has(target)) {
            next.delete(target);
          } else {
            next.add(target);
          }
          return next;
        });
      }
      if (key.return && selectedTargets.size > 0) {
        void runInstall();
      }
      return;
    }

    if (step === 'conflict') {
      if (input === 'm' || input === 'M') {
        setConflictFile(null);
        setStep('progress');
      }
      if (input === 'o' || input === 'O') {
        setConflictFile(null);
        setStep('progress');
      }
      if (input === 's' || input === 'S') {
        setConflictFile(null);
        setStep('progress');
      }
      return;
    }

    if (step === 'done') {
      if (key.return) onDone();
      return;
    }
  });

  if (step === 'scope') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Install {assets.length} asset(s) - Select scope:</Text>
        <Box marginTop={1} flexDirection="column">
          {scopes.map((s, i) => (
            <Text key={s}>
              {i === scopeIndex ? <Text color="cyan">{' > '}</Text> : '   '}
              {s}
            </Text>
          ))}
        </Box>
        <Box marginTop={1}><Text dimColor>↑↓ navigate, Enter select, Escape cancel</Text></Box>
      </Box>
    );
  }

  if (step === 'targets') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Select target tools:</Text>
        <Box marginTop={1} flexDirection="column">
          {targetOptions.map((t, i) => (
            <Text key={t}>
              {i === targetIndex ? <Text color="cyan">{' > '}</Text> : '   '}
              {selectedTargets.has(t) ? '[×] ' : '[ ] '}
              {t}
            </Text>
          ))}
        </Box>
        <Box marginTop={1}><Text dimColor>Space toggle, Enter confirm, Escape cancel</Text></Box>
      </Box>
    );
  }

  if (step === 'conflict') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="yellow">Conflict detected:</Text>
        <Text>{conflictFile}</Text>
        <Box marginTop={1}>
          <Text>[<Text bold>M</Text>]erge  [<Text bold>O</Text>]verwrite  [<Text bold>S</Text>]kip</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'progress' || step === 'done') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>{step === 'done' ? 'Installation complete!' : 'Installing...'}</Text>
        <Box marginTop={1} flexDirection="column">
          {Array.from(results.entries()).map(([name, files]) => (
            <Box key={name} flexDirection="column">
              <Text bold>{name}</Text>
              {files.map((f) => (
                <Box key={f.file} marginLeft={2}>
                  {f.status === 'installing' && (
                    <><Spinner type="dots" /><Text> {f.file}</Text></>
                  )}
                  {f.status === 'pending' && (
                    <Text dimColor>  {f.file}</Text>
                  )}
                  {f.status === 'done' && (
                    <Text color="green">✓ {f.file}</Text>
                  )}
                  {f.status === 'conflict' && (
                    <Text color="yellow">! {f.file}</Text>
                  )}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
        {step === 'done' && suffixNotices.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            {suffixNotices.map((n) => (
              <Box key={n.suffixedName} flexDirection="column">
                <Text color="yellow">⚠ Name conflict: </Text>
                <Text dimColor>  "{n.originalName}" from "{registryName}" installed as "{n.suffixedName}"</Text>
                <Text dimColor>  Reason: "{n.originalName}" already installed from registry "{n.conflictingRegistry}"</Text>
              </Box>
            ))}
          </Box>
        )}
        {step === 'done' && scriptNotices.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            {scriptNotices.map((notice, i) => (
              <Text key={i} color="yellow">{notice}</Text>
            ))}
          </Box>
        )}
        {step === 'done' && <Box marginTop={1}><Text dimColor>Press Enter to continue</Text></Box>}
      </Box>
    );
  }

  return null;
}
