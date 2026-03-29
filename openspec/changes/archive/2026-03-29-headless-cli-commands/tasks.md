## 1. Shared Utilities

- [x] 1.1 Create `src/commands/utils.ts`: implement `resolveRegistry(args, lockfile)` — reads `--registry` flag, handles 0/1/2+ registry cases with TTY detection, returns a `RegistryConfig`
- [x] 1.2 Add `getGitHubToken()` helper in `src/commands/utils.ts` (reuse TUI pattern: `gh auth token` → `GITHUB_TOKEN` env)
- [x] 1.3 Add `parseTypeAndName(args)` helper in `src/commands/utils.ts` — validates that `<type>` is a known asset type and `<name>` is non-empty, exits with usage error otherwise

## 2. Add Command

- [x] 2.1 Create `src/commands/add.ts` with `handleAddCommand(args)` entry point
- [x] 2.2 Implement idempotency check: look up `type`+`name` in lockfile installed entries; print appropriate message and exit 0 if already installed
- [x] 2.3 Implement asset lookup: fetch registry via `getRegistries([resolvedRegistry])`, find asset by type+name, error if not found
- [x] 2.4 Call `installAssetFull()` with resolved scope (default: `project`), resolved targets (default: `asset.targets`), and no `onProgress` callback (headless overwrite default)
- [x] 2.5 Print success confirmation: "Installed <type> '<name>' (v<version>) [<scope>]"
- [x] 2.6 Route `args[0] === 'add'` in `src/cli.tsx` before TUI render

## 3. Remove Command

- [x] 3.1 Create `src/commands/remove.ts` with `handleRemoveCommand(args)` entry point
- [x] 3.2 Look up the lockfile key by matching `type` (from `InstalledAsset.type`) and `name` (last `:` segment of key); error if not found
- [x] 3.3 Call `removeAssetFull(lockfileKey, projectRoot, lockfile)` and print confirmation
- [x] 3.4 Route `args[0] === 'remove'` in `src/cli.tsx`

## 4. Update Command

- [x] 4.1 Create `src/commands/update.ts` with `handleUpdateCommand(args)` entry point
- [x] 4.2 Implement `update <type> <name>`: look up installed entry, error if not found; call `checkUpdates()`, proceed if update available, print "already up to date" if not
- [x] 4.3 Implement `update --all`: call `checkUpdates()` on all installed assets; iterate and call `updateAsset()` for each with an update; print per-asset result
- [x] 4.4 Route `args[0] === 'update'` in `src/cli.tsx`

## 5. List Command

- [x] 5.1 Create `src/commands/list.ts` with `handleListCommand(args)` entry point
- [x] 5.2 Read lockfile; if none or empty, print "no assets installed" and exit 0
- [x] 5.3 Print padded table with columns: TYPE, NAME, VERSION, SCOPE, REGISTRY; derive registry name and asset name from lockfile key
- [x] 5.4 Route `args[0] === 'list'` in `src/cli.tsx`

## 6. Sync Command

- [x] 6.1 Create `src/commands/sync.ts` with `handleSyncCommand(args)` entry point
- [x] 6.2 Read lockfile; if none, print "no lockfile found, nothing to sync" and exit 0
- [x] 6.3 Call `getUnsyncedAssets()` to identify missing assets (excludes orphaned)
- [x] 6.4 Call `syncFromLockfile()` and print per-asset result (installed / skipped / orphaned warning)
- [x] 6.5 Route `args[0] === 'sync'` in `src/cli.tsx`

## 7. Tests

- [x] 7.1 Add `src/__tests__/headless-add.test.ts`: cover single-registry install, multi-registry auto-select, already-installed no-op, asset-not-found error, `--registry` flag, `--scope`/`--target` flags
- [x] 7.2 Add `src/__tests__/headless-remove.test.ts`: cover successful remove, not-installed error
- [x] 7.3 Add `src/__tests__/headless-update.test.ts`: cover update-one (with update, already up to date, not installed), update-all (mixed results)
- [x] 7.4 Add `src/__tests__/headless-list.test.ts`: cover table output with assets, empty lockfile, no lockfile
- [x] 7.5 Add `src/__tests__/headless-sync.test.ts`: cover sync restores missing, all present, orphaned skip, no lockfile
