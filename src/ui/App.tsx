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
import { SyncView } from './views/SyncView.js';
import { SetupView } from './views/SetupView.js';
import { RegistriesView } from './views/RegistriesView.js';
import { useFilter } from './hooks/useFilter.js';
import type { RegistryAsset } from '../registry/types.js';
import type { Lockfile, RegistryConfig } from '../lockfile/types.js';
import { getRegistries } from '../registry/client.js';
import { readLockfile, writeLockfile } from '../lockfile/index.js';
import { getProjectRoot } from '../config/paths.js';
import { getUnsyncedAssets } from '../lockfile/index.js';
import { execFileSync } from 'node:child_process';

export type ViewName = 'browse' | 'install' | 'updates' | 'installed' | 'sync' | 'registries';

const viewLabels: Record<ViewName, string> = {
  browse: 'Browse',
  install: 'Install',
  updates: 'Updates',
  installed: 'Installed',
  sync: 'Sync',
  registries: 'Registries',
};

// header (2) + search (1) + footer (1)
const CHROME_ROWS = 4;

function resolveGithubToken(): string | undefined {
  if (process.env['GITHUB_TOKEN']) return process.env['GITHUB_TOKEN'];
  try {
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf-8' }).trim();
    if (token) return token;
  } catch { /* gh not installed or not authenticated */ }
  return undefined;
}

export function App() {
  const { stdout } = useStdout();
  const browseHeight = Math.max(5, (stdout.rows ?? 24) - CHROME_ROWS);
  const { exit } = useApp();

  // Data loading
  const [loadState, setLoadState] = useState<'setup' | 'loading' | 'error' | 'ready'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [assets, setAssets] = useState<RegistryAsset[]>([]);
  const [lockfile, setLockfile] = useState<Lockfile | null>(null);
  const [githubToken] = useState<string | undefined>(resolveGithubToken);
  const [staleWarnings, setStaleWarnings] = useState<string[]>([]);
  const [projectRoot, setProjectRoot] = useState('');

  // View routing
  const [view, setView] = useState<ViewName>('browse');
  const [showHelp, setShowHelp] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [installTargets, setInstallTargets] = useState<RegistryAsset[]>([]);

  // Sync state
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // Browse state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchActive, setSearchActive] = useState(false);
  const { search, setSearch, typeFilter, targetFilter, filtered } = useFilter(assets);

  const loadRegistry = useCallback(async (initialLockfile?: Lockfile) => {
    try {
      const root = getProjectRoot(process.cwd()) ?? process.cwd();
      setProjectRoot(root);
      const lf = initialLockfile ?? readLockfile(root);

      if (!lf || lf.registries.length === 0) {
        setLoadState('setup');
        return;
      }

      setLockfile(lf);
      setUnsyncedCount(getUnsyncedAssets(lf, root).length);

      const token = githubToken;
      const { assets: registryAssets, warnings } = await getRegistries(lf.registries, token);
      setAssets(registryAssets);
      setStaleWarnings(warnings.map((w) => w.message));
      setLoadState('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setLoadState('error');
    }
  }, [githubToken]);

  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry]);

  const refreshLockfile = useCallback(() => {
    if (projectRoot) {
      const lf = readLockfile(projectRoot);
      setLockfile(lf);
      setUnsyncedCount(getUnsyncedAssets(lf, projectRoot).length);
    }
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
    if (input === 'R') { setView('registries'); return; }
    if (input === 's' && unsyncedCount > 0) { setView('sync'); return; }
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

  if (loadState === 'setup') {
    return (
      <SetupView
        onDone={(registries) => {
          setLoadState('loading');
          const root = projectRoot || getProjectRoot(process.cwd()) || process.cwd();
          const newLockfile: Lockfile = {
            version: 2,
            registries,
            installed: {},
          };
          writeLockfile(root, newLockfile);
          void loadRegistry(newLockfile);
        }}
      />
    );
  }

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
        <Header viewName={viewLabels[view]} staleWarnings={staleWarnings} />
        <HelpOverlay onClose={() => setShowHelp(false)} />
      </Box>
    );
  }

  if (view === 'registries') {
    return (
      <Box flexDirection="column" width="100%">
        <Header viewName="Registries" staleWarnings={[]} />
        <RegistriesView
          lockfile={lockfile}
          projectRoot={projectRoot}
          assets={assets}
          onDone={() => {
            refreshLockfile();
            void loadRegistry(readLockfile(projectRoot) ?? undefined);
            setView('browse');
          }}
          onCancel={() => setView('browse')}
        />
      </Box>
    );
  }

  if (view === 'install') {
    // Determine registry info from the first asset's registryName or fallback to first configured registry
    const firstAsset = installTargets[0];
    const registryName = firstAsset?.registryName || lockfile?.registries[0]?.name || '';
    const registryBaseUrl = lockfile?.registries.find((r) => r.name === registryName)?.url
      || lockfile?.registries[0]?.url || '';

    return (
      <Box flexDirection="column" width="100%">
        <Header viewName="Install" staleWarnings={[]} />
        <InstallView
          assets={installTargets}
          registryBaseUrl={registryBaseUrl}
          registryName={registryName}
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
        <Header viewName="Updates" staleWarnings={[]} />
        <UpdateView
          assets={assets}
          lockfile={lockfile}
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
          <Header viewName="Remove" staleWarnings={[]} />
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
        <Header viewName="Installed" staleWarnings={[]} />
        <InstalledView
          lockfile={lockfile}
          onRemove={(key) => setRemoveTarget(key)}
        />
        <Footer />
      </Box>
    );
  }

  if (view === 'sync') {
    return (
      <Box flexDirection="column" width="100%">
        <Header viewName="Sync" staleWarnings={[]} />
        <SyncView
          lockfile={lockfile}
          assets={assets}
          projectRoot={projectRoot}
          githubToken={githubToken}
          onDone={() => { refreshLockfile(); setView('browse'); }}
        />
      </Box>
    );
  }

  // Browse view (default)
  const staleWarning = staleWarnings[0] ?? null;
  return (
    <Box flexDirection="column" width="100%">
      <Header viewName="Browse" staleWarnings={staleWarnings} />
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
            registryBaseUrl={lockfile?.registries.find((r) => r.name === filtered[selectedIndex]?.registryName)?.url || lockfile?.registries[0]?.url || ''}
            githubToken={githubToken}
          />
        </Box>
      </Box>
      <Footer unsyncedCount={unsyncedCount} />
    </Box>
  );
}

function Header({ viewName, staleWarnings }: { viewName: string; staleWarnings: string[] }) {
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
      {staleWarnings.map((w, i) => (
        <Text key={i} color="yellow" dimColor>⚠ {w}</Text>
      ))}
    </Box>
  );
}
