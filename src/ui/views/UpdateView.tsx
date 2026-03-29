import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { RegistryAsset } from '../../registry/types.js';
import type { Lockfile } from '../../lockfile/types.js';
import { checkUpdates, updateAsset, planUpdateResult, type UpdateResult, type UpdateCheck } from '../../engine/update.js';
import type { InstallPlan } from '../../engine/types.js';
import { ScriptRiskDisclaimer } from '../components/ScriptRiskDisclaimer.js';

interface UpdateViewProps {
  assets: RegistryAsset[];
  lockfile: Lockfile | null;
  projectRoot: string;
  onDone: () => void;
  githubToken?: string;
}

export function UpdateView({ assets, lockfile, projectRoot, onDone, githubToken }: UpdateViewProps) {
  const updates = checkUpdates(lockfile, assets);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [pendingDisclaimerInfo, setPendingDisclaimerInfo] = useState<{
    asset: RegistryAsset;
    lockfileKey: string;
    plan: InstallPlan;
    scripts: string[];
  } | null>(null);

  useEffect(() => {
    if (updates.length > 0) {
      setSelectedIndex((i) => Math.min(updates.length - 1, Math.max(0, i)));
    }
  }, [updates.length]);
  const [results, setResults] = useState<UpdateResult[]>([]);

  const handleUpdateOne = useCallback(async () => {
    if (!lockfile || updates.length === 0) return;
    setUpdating(true);
    const update = updates[selectedIndex];
    const asset = assets.find((a) => a.name === update.name && a.registryName === update.lockfileKey.split(':')[0]);
    if (!asset) { setUpdating(false); return; }
    // Phase 1: plan to detect script changes
    const planResult = await planUpdateResult(asset, update.lockfileKey, lockfile, projectRoot, githubToken);
    setUpdating(false);
    if (!planResult) return;
    if (planResult.scriptChanged) {
      setPendingDisclaimerInfo({ asset, lockfileKey: update.lockfileKey, plan: planResult.plan, scripts: planResult.scriptsForDisclaimer });
      return;
    }
    // Phase 2: execute immediately (no script change)
    setUpdating(true);
    const result = await updateAsset(asset, update.lockfileKey, lockfile, projectRoot, githubToken);
    setUpdating(false);
    setResults((prev) => [...prev, result]);
  }, [lockfile, updates, selectedIndex, projectRoot, githubToken, assets]);

  const handleUpdateAll = useCallback(async () => {
    if (!lockfile || updates.length === 0) return;
    setUpdating(true);
    const allResults: UpdateResult[] = [];
    for (const update of updates) {
      const asset = assets.find(
        (a) => a.name === update.name && a.registryName === update.lockfileKey.split(':')[0],
      );
      if (!asset) continue;
      // Phase 1: plan to detect script changes
      const planResult = await planUpdateResult(asset, update.lockfileKey, lockfile, projectRoot, githubToken);
      if (!planResult) continue;
      if (planResult.scriptChanged) {
        setUpdating(false);
        setPendingDisclaimerInfo({ asset, lockfileKey: update.lockfileKey, plan: planResult.plan, scripts: planResult.scriptsForDisclaimer });
        return;
      }
      // Phase 2: execute immediately (no script change)
      const result = await updateAsset(asset, update.lockfileKey, lockfile, projectRoot, githubToken);
      allResults.push(result);
    }
    setUpdating(false);
    setResults(allResults);
  }, [lockfile, updates, assets, projectRoot, githubToken]);

  useInput((input, key) => {
    if (pendingDisclaimerInfo) return; // ScriptRiskDisclaimer handles input
    if (key.escape) {
      onDone();
      return;
    }
    if (key.upArrow && updates.length > 0) setSelectedIndex((i) => Math.max(0, i - 1));
    if (key.downArrow && updates.length > 0) setSelectedIndex((i) => Math.min(updates.length - 1, i + 1));
    if (input === 'u' && !updating) void handleUpdateOne();
    if (input === 'U' && !updating) void handleUpdateAll();
  });

  if (pendingDisclaimerInfo) {
    return (
      <Box flexDirection="column" padding={1}>
        <ScriptRiskDisclaimer
          assetName={pendingDisclaimerInfo.asset.name}
          scripts={pendingDisclaimerInfo.scripts}
          scriptRisksContent={pendingDisclaimerInfo.plan.scriptRisksContent}
          hasDeclaredScriptRisks={!!pendingDisclaimerInfo.plan.manifest?.scriptRisks}
          scriptChanged
          onAccept={() => {
            const ts = new Date().toISOString();
            const { asset, lockfileKey, plan: _plan } = pendingDisclaimerInfo;
            setPendingDisclaimerInfo(null);
            void (async () => {
              setUpdating(true);
              const result = await updateAsset(asset, lockfileKey, lockfile!, projectRoot, githubToken, { riskAccepted: true, riskAcceptedAt: ts });
              setUpdating(false);
              setResults((prev) => [...prev, result]);
            })();
          }}
          onCancel={() => {
            setPendingDisclaimerInfo(null);
          }}
        />
      </Box>
    );
  }

  if (updates.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Updates</Text>
        <Text dimColor>All assets are up to date.</Text>
        <Box marginTop={1}><Text dimColor>Escape to go back</Text></Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Available Updates ({updates.length})</Text>
      {updating && (
        <Box>
          <Spinner type="dots" />
          <Text> Updating...</Text>
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        {updates.map((update, index) => {
          const wasUpdated = results.some((r) => r.asset === update.name && r.success);
          return (
            <Box key={update.lockfileKey}>
              <Text inverse={index === selectedIndex}>
                {wasUpdated ? (
                  <Text color="green">✓ </Text>
                ) : (
                  <Text color="yellow">↑ </Text>
                )}
                <Text>{update.name} </Text>
                <Text dimColor>{update.installedVersion} → {update.latestVersion}</Text>
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}><Text dimColor>u update selected, U update all, Escape back</Text></Box>
    </Box>
  );
}
