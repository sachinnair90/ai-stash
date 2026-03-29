import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { GENERIC_SCRIPT_RISKS } from '../../engine/script-risks.js';

interface ScriptRiskDisclaimerProps {
  assetName: string;
  scripts: string[];
  scriptRisksContent?: string;
  hasDeclaredScriptRisks?: boolean;
  scriptChanged?: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function ScriptRiskDisclaimer({
  assetName,
  scripts,
  scriptRisksContent,
  hasDeclaredScriptRisks,
  scriptChanged,
  onAccept,
  onCancel,
}: ScriptRiskDisclaimerProps) {
  const [highlighted, setHighlighted] = useState<'accept' | 'cancel'>('cancel');

  useInput((input, key) => {
    if (key.leftArrow || key.rightArrow || input === '\t') {
      setHighlighted((h) => (h === 'accept' ? 'cancel' : 'accept'));
    }
    if (key.return) {
      if (highlighted === 'accept') {
        onAccept();
      } else {
        onCancel();
      }
    }
    if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="yellow">
      {scriptChanged && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">⚠️  Script changed since last install — please re-review</Text>
        </Box>
      )}

      {/* Generic risk section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">Script Risk Warning</Text>
        {GENERIC_SCRIPT_RISKS.split('\n').map((line, i) => (
          <Text key={i} dimColor={line === ''}>{line}</Text>
        ))}
      </Box>

      {/* Author risk documentation — only when author declared scriptRisks */}
      {hasDeclaredScriptRisks && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>{'─'.repeat(50)}</Text>
          <Text bold>{`Author's Risk Documentation — ${assetName}`}</Text>
          <Text bold>{'─'.repeat(50)}</Text>
          {scriptRisksContent !== undefined ? (
            scriptRisksContent.trim().split('\n').map((line, i) => (
              <Text key={i} dimColor={line === ''}>{line}</Text>
            ))
          ) : (
            <Text dimColor>Author risk documentation unavailable.</Text>
          )}
        </Box>
      )}

      {/* Declared scripts */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>{'─'.repeat(50)}</Text>
        <Text bold>{`Declared scripts for ${assetName}:`}</Text>
        {scripts.map((s, i) => <Text key={i}>  • {s}</Text>)}
      </Box>

      {/* Controls */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text
            inverse={highlighted === 'cancel'}
            color={highlighted === 'cancel' ? 'white' : 'gray'}
          >
            {' Cancel '}
          </Text>
          <Text>  </Text>
          <Text
            inverse={highlighted === 'accept'}
            color={highlighted === 'accept' ? 'green' : 'gray'}
          >
            {' Accept risks and install '}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>←→/Tab to switch, Enter to confirm, Escape to cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}
