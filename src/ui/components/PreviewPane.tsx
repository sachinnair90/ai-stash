import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { RegistryAsset } from '../../registry/types.js';
import { fetchAssetFile } from '../../registry/fetcher.js';

interface PreviewPaneProps {
  asset: RegistryAsset | null;
  registryBaseUrl: string;
  githubToken?: string;
}

export function PreviewPane({ asset, registryBaseUrl, githubToken }: PreviewPaneProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    setContent(null);
    setError(null);
    setScrollOffset(0);

    if (!asset || asset.files.length === 0) return;

    let cancelled = false;
    setLoading(true);

    fetchAssetFile(registryBaseUrl, asset.files[0], githubToken)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asset, registryBaseUrl]);

  useInput((input, key) => {
    if (key.pageDown) {
      setScrollOffset((prev) => prev + 10);
    }
    if (key.pageUp) {
      setScrollOffset((prev) => Math.max(0, prev - 10));
    }
  });

  if (!asset) {
    return (
      <Box padding={1}>
        <Text dimColor>Select an asset to preview</Text>
      </Box>
    );
  }

  const lines: string[] = [];
  lines.push(`Name: ${asset.name}`);
  lines.push(`Type: ${asset.type}`);
  lines.push(`Version: ${asset.version}`);
  lines.push(`Description: ${asset.description}`);
  lines.push(`Tags: ${asset.tags.join(', ') || 'none'}`);
  lines.push(`Targets: ${asset.targets.join(', ')}`);
  lines.push('');

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        {lines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
        <Box>
          <Spinner type="dots" />
          <Text> Loading file content...</Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    lines.push(`Error loading file: ${error}`);
  } else if (content) {
    lines.push('--- File Content ---');
    lines.push(content);
  }

  const allLines = lines.join('\n').split('\n');
  const visible = allLines.slice(scrollOffset, scrollOffset + 20);

  return (
    <Box flexDirection="column" padding={1}>
      {visible.map((line, i) => (
        <Text key={scrollOffset + i}>{line}</Text>
      ))}
      {allLines.length > 20 && (
        <Text dimColor>
          [{scrollOffset + 1}-{Math.min(scrollOffset + 20, allLines.length)} of {allLines.length}] PageUp/PageDown to scroll
        </Text>
      )}
    </Box>
  );
}
