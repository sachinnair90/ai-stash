## 1. Engine — sync function

- [x] 1.1 Add `getUnsyncedAssets(lockfile, projectRoot)` to `src/lockfile/index.ts` — returns entries whose first file is absent on disk
- [x] 1.2 Add `syncFromLockfile(lockfile, assets, projectRoot, registryBaseUrl, githubToken?)` to `src/engine/install.ts` — iterates unsynced entries, matches each to a `RegistryAsset`, calls `planInstall` + `executeInstall` using the lockfile's recorded scope and targets

## 2. UI — Sync view

- [x] 2.1 Create `src/ui/views/SyncView.tsx` — lists unsynced assets, prompts `y` to confirm or `Escape` to cancel, shows per-asset install progress, displays a summary on completion including any skipped assets
- [x] 2.2 Export `SyncView` from the views index (or directly from the file path)

## 3. UI — Footer badge

- [x] 3.1 Update `Footer` props in `src/ui/components/Footer.tsx` to accept `unsyncedCount?: number`
- [x] 3.2 Render `s sync (N)` hint in the footer when `unsyncedCount > 0`, plain `s sync` hint otherwise (hidden entirely when count is 0 and no lockfile)

## 4. App wiring

- [x] 4.1 Add `'sync'` to the `ViewName` union in `src/ui/App.tsx`
- [x] 4.2 Compute `unsyncedCount` in App using `getUnsyncedAssets` after lockfile and assets are loaded; recompute after `refreshLockfile()`
- [x] 4.3 Handle `s` keypress in Browse view — navigate to `sync` view only when `unsyncedCount > 0`
- [x] 4.4 Render `<SyncView>` in the `view === 'sync'` branch, passing `lockfile`, `assets`, `registryBaseUrl`, `projectRoot`, `githubToken`, and `onDone` (calls `refreshLockfile` then returns to browse)
- [x] 4.5 Pass `unsyncedCount` to `<Footer>` in the Browse view render

## 5. README

- [x] 5.1 Update the "Bootstrapping from a shared lockfile" section to document the `s` sync shortcut and remove the manual step-by-step workaround
- [x] 5.2 Remove the "Note: There is currently no single-command sync..." caveat
