## 1. Lockfile Types and Migration

- [x] 1.1 Update `src/lockfile/types.ts`: change `Lockfile.registry: string` to `registries: RegistryConfig[]`, bump version to `2`, add `registryUrl: string` to `InstalledAsset`, add `RegistryConfig` interface (`name`, `url`)
- [x] 1.2 Update `src/lockfile/reader.ts`: detect `version === 1`, run migration (write backup, rekey entries to `registry:type:name`, backfill `registryUrl`, populate `registries[]`, write v2 lockfile)
- [x] 1.3 Update `src/lockfile/writer.ts`: write `version: 2` format with `registries[]` array
- [x] 1.4 Update all callsites that reference `lockfile.registry` (single string) to use `lockfile.registries[]`

## 2. Remove Config Layer

- [x] 2.1 Delete `src/config/loader.ts`, `src/config/types.ts`
- [x] 2.2 Remove `getConfigDir()` from `src/config/paths.ts`; keep `getCacheDir()`
- [x] 2.3 Remove `~/.config/ai-stash/config.json` references from all code and tests
- [x] 2.4 Update `App.tsx` to load registries from lockfile instead of `loadConfig()`

## 3. Registry Client — Multi-Registry Fetch and Per-Registry Cache

- [x] 3.1 Update `src/registry/cache.ts`: change cache filename from `registry.json` to `registry-<urlhash>.json` (short SHA-256 prefix of URL); update read/write functions to accept a URL parameter
- [x] 3.2 Update `src/registry/client.ts`: replace `getRegistry(config)` with `getRegistries(registries: RegistryConfig[])` that fetches all registries in parallel, returns merged `RegistryAsset[]` with `registryName` tagged on each asset, and per-registry stale warnings
- [x] 3.3 Update `src/registry/types.ts`: add `registryName: string` field to `RegistryAsset`
- [x] 3.4 Update `App.tsx` and all callers of `getRegistry()` to use new `getRegistries()` signature

## 4. Install Engine — Key Format and Conflict Resolution

- [x] 4.1 Add `resolveForInstall()` helper in `src/engine/install.ts`: checks lockfile for same-type, same-name entry from a different `registryUrl`; if conflict, derives suffixed name (`name-registryname`) and returns resolved `RegistryAsset` and lockfile key (`registry:type:name`)
- [x] 4.2 Update `planInstall()` to call `resolveForInstall()` and use the resolved asset name throughout (paths, content transforms)
- [x] 4.3 Update `executeInstall()`: use `registry:type:name` as lockfile key; store `registryUrl` in `InstalledAsset`
- [x] 4.4 Update `installAsset()` TUI wrapper: detect when suffix was applied and return suffix info for post-install notice
- [x] 4.5 Update `InstallView.tsx` to show post-install notice when suffix was applied

## 5. Update and Sync Engines

- [x] 5.1 Update `checkUpdates()` in `src/engine/update.ts`: parse `registry:type:name` key to extract original asset name; use `InstalledAsset.registryUrl` to look up asset in the correct registry's asset list
- [x] 5.2 Update `updateAssetFull()` and `updateAsset()`: use `InstalledAsset.registryUrl` as the registry base URL for fetching
- [x] 5.3 Update `syncFromLockfile()` in `src/engine/install.ts`: use `InstalledAsset.registryUrl` and name from key for lookup; skip orphaned assets (registry name not in `registries[]`) and report them as skipped with reason
- [x] 5.4 Update `getUnsyncedAssets()` in `src/lockfile/index.ts`: exclude orphaned assets from unsynced count

## 6. Registry Management — CLI Subcommands

- [x] 6.1 Add `src/commands/registry.ts`: implement `registry add <url> --name <name>`, `registry remove <name>`, `registry list` subcommands; each reads and writes the lockfile `registries[]`
- [x] 6.2 Update `src/cli.tsx`: detect `registry` as first argument and route to registry subcommands before rendering TUI
- [x] 6.3 Add validation: reject duplicate name or URL on `registry add`; warn about orphaned assets on `registry remove`

## 7. Registry Management — TUI

- [x] 7.1 Create `src/ui/views/RegistriesView.tsx`: list configured registries (name, URL, asset count); support `a` to add, `d` to remove (with confirmation), Escape to return to Browse
- [x] 7.2 Update `src/ui/App.tsx`: add `registries` to `ViewName` union; add `R` key binding in Browse view to navigate to Registries view; pass `registries` state to `RegistriesView`
- [x] 7.3 Update `SetupView.tsx`: support adding multiple registries in the first-run flow; create lockfile with `registries[]` populated on completion

## 8. Orphaned Asset Display

- [x] 8.1 Update `src/ui/views/InstalledView.tsx`: detect orphaned entries (registry name from key not in `lockfile.registries[].name`); render ⚠ indicator and "registry '<name>' not configured" label
- [x] 8.2 Ensure remove action still works for orphaned assets (files on disk, no registry contact needed)

## 9. Tests

- [x] 9.1 Update lockfile tests (`src/__tests__/lockfile.test.ts`): cover v1→v2 migration, new key format, `registryUrl` field, backup file creation
- [x] 9.2 Update install engine tests (`src/__tests__/install-engine.test.ts`): cover `resolveForInstall()` conflict detection, suffix application, `registry:type:name` key generation
- [x] 9.3 Update registry client tests (`src/__tests__/registry-client.test.ts`): cover multi-registry fetch, per-registry cache files, partial failure handling
- [x] 9.4 Update integration lifecycle tests (`src/__tests__/integration.test.ts`): cover full install→update→remove cycle with multiple registries and conflict suffix
- [x] 9.5 Add orphaned asset tests: registry removed after install, update/sync skip, remove still works
