## Why

ai-stash currently supports a single registry per project, stored in a separate config file that lives outside the project. This prevents teams from sharing registry configuration, makes it impossible to source assets from multiple registries (e.g., a private company registry alongside a public community registry), and creates a two-file mental model where the lockfile and config must be kept in sync manually.

## What Changes

- **BREAKING** `ai-stash.lock.json` format bumps from v1 to v2: lockfile key changes from `"name"` to `"registry:type:name"`, and a top-level `registries[]` array replaces the old `registry` string field
- **BREAKING** `src/config/` module eliminated — registries move into the lockfile, config file (`~/.config/ai-stash/config.json`) is removed
- Multiple registries supported per project, all equal in priority (no primary/secondary)
- Asset identity becomes type-scoped: a `skill` and `command` with the same name no longer collide
- Suffix-on-conflict: installing a same-type, same-name asset from a different registry installs it under `name-registryname` on disk (post-install notice explains why)
- Orphaned assets (registry name in key not found in `registries[]`) shown with warning in Installed view
- Registry management added: TUI Registries view + CLI subcommands (`registry add`, `registry remove`, `registry list`)
- Per-registry cache files replace the single cache file
- v1 → v2 lockfile migration runs automatically on first read

## Capabilities

### New Capabilities

- `multi-registry`: Support for multiple named registries per project — add, remove, list registries; fetch and merge assets from all configured registries; per-registry cache
- `registry-conflict-resolution`: Detect and resolve same-type, same-name asset conflicts across registries via install-time suffix; post-install notice; orphaned asset detection and display

### Modified Capabilities

- `registry-client`: Registry fetching now operates per-registry URL rather than a single configured URL; cache is keyed per registry
- `asset-installation`: Install path and lockfile key now incorporate asset type; conflict detection checks type+name+registry triple; suffix applied to disk name on conflict
- `lockfile-sync`: Lockfile v2 format with `registry:type:name` keys; `registries[]` top-level array; `InstalledAsset.registryUrl` field; automatic v1→v2 migration

## Impact

- **Lockfile**: breaking format change — all consumers of `Lockfile` and `InstalledAsset` types need updating
- **Config layer** (`src/config/`): entirely removed; callers refactored to read from lockfile
- **Registry client** (`src/registry/`): `getRegistry()` signature changes to accept multiple registries; cache module updated for per-registry files
- **Install engine** (`src/engine/install.ts`): conflict detection and suffix logic added; lockfile key generation updated
- **Update engine** (`src/engine/update.ts`): `checkUpdates()` uses `registryUrl` per asset; `syncFromLockfile()` resolves registry by URL
- **UI** (`src/ui/`): `App.tsx` drops config loading; new Registries view; SetupView updated for multi-registry add flow; Installed view shows orphaned asset warnings
- **CLI** (`src/cli.tsx`): new `registry` subcommand group
