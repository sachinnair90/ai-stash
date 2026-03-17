import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import { Footer } from './components/Footer.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { AssetList } from './components/AssetList.js';
import { SearchBar } from './components/SearchBar.js';
import { PreviewPane } from './components/PreviewPane.js';
import { InstallView } from './views/InstallView.js';
import { UpdateView } from './views/UpdateView.js';
import { InstalledView } from './views/InstalledView.js';
import { RemoveView } from './views/RemoveView.js';
import { useFilter } from './hooks/useFilter.js';
import type { RegistryAsset } from '../registry/types.js';
import type { Lockfile } from '../lockfile/types.js';
import { loadConfig } from '../config/loader.js';
import { getRegistry } from '../registry/client.js';
import { readLockfile } from '../lockfile/reader.js';
import { getProjectRoot } from '../config/paths.js';

export type ViewName = 'browse' | 'install' | 'updates' | 'installed';

const viewLabels: Record<ViewName, string> = {
  browse: 'Browse',
  install: 'Install',
  updates: 'Updates',
  installed: 'Installed',
};

// header (2) + search (1) + footer (1)
const CHROME_ROWS = 4;

export function App() {
  const { stdout } = useStdout();
  const browseHeight = Math.max(5, (stdout.rows ?? 24) - CHROME_ROWS);
  const { exit } = useApp();

  // Data loading
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [assets, setAssets] = useState<RegistryAsset[]>([]);
  const [lockfile, setLockfile] = useState<Lockfile | null>(null);
  const [registryBaseUrl, setRegistryBaseUrl] = useState('');
  const [githubToken, setGithubToken] = useState<string | undefined>(undefined);
  const [staleWarning, setStaleWarning] = useState<string | null>(null);
  const [projectRoot, setProjectRoot] = useState('');

  // View routing
  const [view, setView] = useState<ViewName>('browse');
  const [showHelp, setShowHelp] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [installTargets, setInstallTargets] = useState<RegistryAsset[]>([]);

  // Browse state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchActive, setSearchActive] = useState(false);
  const { search, setSearch, typeFilter, targetFilter, filtered } = useFilter(assets);

  useEffect(() => {
    async function load() {
      try {
        const config = loadConfig();
        setRegistryBaseUrl(config.registry.url);
        setGithubToken(config.githubToken);
        const root = getProjectRoot(process.cwd()) ?? process.cwd();
        setProjectRoot(root);
        setLockfile(readLockfile(root));
        const { registry, stale, cacheAge } = await getRegistry(config);
        setAssets(registry.assets);
        if (stale) {
          const mins = Math.round(cacheAge / 60000);
          setStaleWarning(`Using cached registry (${mins}m old)`);
        }
        setLoadState('ready');
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setLoadState('error');
      }
    }
    void load();
  }, []);

  const refreshLockfile = useCallback(() => {
    if (projectRoot) setLockfile(readLockfile(projectRoot));
  }, [projectRoot]);

  const toggleSelect = useCallback((name: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  useInput((input, key) => {
    if (loadState !== 'ready') {
      if (input === 'q') exit();
      return;
    }
    if (showHelp) {
      if (input === '?' || key.escape) setShowHelp(false);
      return;
    }

    // Global keys that work in every view
    if (input === 'q') { exit(); return; }
    if (input === '?') { setShowHelp(true); return; }
    if (key.escape && view !== 'browse') { setView('browse'); return; }

    if (view !== 'browse') return;

    if (input === 'u') { setView('updates'); return; }
    if (input === 'l') { setView('installed'); return; }
    if (input === '/') { setSearchActive(true); return; }

    if (key.escape) {
      if (searchActive) { setSearchActive(false); setSearch(''); }
      return;
    }

    if (!searchActive) {
      if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
      if (key.downArrow) setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
      if (input === ' ') {
        const asset = filtered[selectedIndex];
        if (asset) toggleSelect(asset.name);
      }
      if (input === 'i') {
        const targets = selectedItems.size > 0
          ? filtered.filter((a) => selectedItems.has(a.name))
          : filtered[selectedIndex] ? [filtered[selectedIndex]] : [];
        if (targets.length > 0) {
          setInstallTargets(targets);
          setView('install');
        }
      }
    }
  });

  if (loadState === 'loading') {
    return (
      <Box padding={1}>
        <Spinner type="dots" />
        <Text> Loading registry...</Text>
      </Box>
    );
  }

  if (loadState === 'error') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {errorMsg}</Text>
        <Text dimColor>Press q to quit</Text>
      </Box>
    );
  }

  if (showHelp) {
    return (
      <Box flexDirection="column" width="100%">
        <Header viewName={viewLabels[view]} staleWarning={staleWarning} />
        <HelpOverlay onClose={() => setShowHelp(false)} />
      </Box>
    );
  }

  if (view === 'install') {
    return (
      <Box flexDirection="column" width="100%">
        <Header viewName="Install" staleWarning={null} />
        <InstallView
          assets={installTargets}
          registryBaseUrl={registryBaseUrl}
          projectRoot={projectRoot}
          githubToken={githubToken}
          onDone={() => { refreshLockfile(); setView('browse'); setInstallTargets([]); setSelectedItems(new Set()); }}
          onCancel={() => { setView('browse'); setInstallTargets([]); }}
        />
      </Box>
    );
  }

  if (view === 'updates') {
    return (
      <Box flexDirection="column" width="100%">
        <Header viewName="Updates" staleWarning={null} />
        <UpdateView
          assets={assets}
          lockfile={lockfile}
          registryBaseUrl={registryBaseUrl}
          projectRoot={projectRoot}
          githubToken={githubToken}
          onDone={() => { refreshLockfile(); setView('browse'); }}
        />
      </Box>
    );
  }

  if (view === 'installed') {
    if (removeTarget !== null && lockfile !== null) {
      return (
        <Box flexDirection="column" width="100%">
          <Header viewName="Remove" staleWarning={null} />
          <RemoveView
            assetName={removeTarget}
            lockfile={lockfile}
            projectRoot={projectRoot}
            onDone={() => { refreshLockfile(); setRemoveTarget(null); }}
            onCancel={() => setRemoveTarget(null)}
          />
        </Box>
      );
    }
    return (
      <Box flexDirection="column" width="100%">
        <Header viewName="Installed" staleWarning={null} />
        <InstalledView
          lockfile={lockfile}
          onRemove={(name) => setRemoveTarget(name)}
        />
        <Footer />
      </Box>
    );
  }

  // Browse view (default)
  return (
    <Box flexDirection="column" width="100%">
      <Header viewName="Browse" staleWarning={staleWarning} />
      <SearchBar
        value={search}
        onChange={setSearch}
        isActive={searchActive}
        typeFilter={typeFilter}
        targetFilter={targetFilter}
      />
      <Box flexGrow={1} flexDirection="row">
        <Box flexDirection="column" width="50%">
          <AssetList
            assets={filtered}
            selectedIndex={selectedIndex}
            selectedItems={selectedItems}
            lockfile={lockfile}
            onSelect={setSelectedIndex}
            onToggle={toggleSelect}
          />
        </Box>
        <Box
          flexDirection="column"
          width="50%"
          borderStyle="single"
          borderLeft
          borderRight={false}
          borderTop={false}
          borderBottom={false}
        >
          <PreviewPane
            asset={filtered[selectedIndex] ?? null}
            registryBaseUrl={registryBaseUrl}
            githubToken={githubToken}
          />
        </Box>
      </Box>
      <Footer />
    </Box>
  );
}

function Header({ viewName, staleWarning }: { viewName: string; staleWarning: string | null }) {
  return (
    <Box
      borderStyle="single"
      borderBottom
      borderTop={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
      flexDirection="column"
    >
      <Box>
        <Text bold color="cyan">ai-stash</Text>
        <Text dimColor> | </Text>
        <Text>{viewName}</Text>
      </Box>
      {staleWarning && <Text color="yellow" dimColor>⚠ {staleWarning}</Text>}
    </Box>
  );
}
