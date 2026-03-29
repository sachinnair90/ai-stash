### Requirement: Detect unsynced assets
The system SHALL compare the lockfile's installed entries against the local filesystem and identify assets whose files are not present on disk. Orphaned assets (registry name not in `registries[]`) SHALL be excluded from the unsynced count and handled separately.

#### Scenario: All assets present
- **WHEN** every file listed in each lockfile entry exists on disk
- **THEN** the system reports zero unsynced assets

#### Scenario: Some assets missing
- **WHEN** one or more non-orphaned lockfile entries have a missing first file on disk
- **THEN** the system identifies those entries as unsynced

#### Scenario: No lockfile
- **WHEN** no `ai-stash.lock.json` is present in the project root
- **THEN** the system shows no unsynced badge and the sync shortcut does nothing

#### Scenario: Orphaned assets excluded from unsynced count
- **WHEN** some lockfile entries reference a registry name not in `registries[]`
- **THEN** those entries are not counted as unsynced; they are shown separately in the Installed view with a warning

### Requirement: Show unsynced badge in footer
The system SHALL display a count of unsynced assets in the Browse view footer when one or more assets are missing locally.

#### Scenario: Badge visible when assets are unsynced
- **WHEN** the Browse view loads and unsynced assets are detected
- **THEN** the footer shows `s sync (N)` where N is the count of unsynced assets

#### Scenario: Badge hidden when fully synced
- **WHEN** all lockfile assets are present on disk
- **THEN** the footer shows no sync indicator

### Requirement: Sync view accessible from Browse
The system SHALL provide a Sync view reachable by pressing `s` in the Browse view that lists all unsynced assets.

#### Scenario: Enter sync view
- **WHEN** the user presses `s` from the Browse view and unsynced assets exist
- **THEN** the system navigates to the Sync view showing the list of unsynced assets

#### Scenario: No action when fully synced
- **WHEN** the user presses `s` and no assets are unsynced
- **THEN** the system does not navigate away from the Browse view

### Requirement: Sync installs all missing assets
The system SHALL install all unsynced assets in batch using the scope and targets recorded in the lockfile, without prompting the user for those values. For each asset, the system SHALL fetch from the registry URL stored in `InstalledAsset.registryUrl` and look up the asset by the name encoded in the lockfile key (the third segment of `"registry:type:name"`).

#### Scenario: Confirm and sync
- **WHEN** the user confirms the sync operation in the Sync view
- **THEN** the system installs each unsynced asset using its lockfile-recorded scope, targets, and `registryUrl`, showing per-asset progress

#### Scenario: Cancel sync
- **WHEN** the user cancels or presses Escape in the Sync view before confirming
- **THEN** no files are written and the user returns to the Browse view

#### Scenario: Asset not found in registry
- **WHEN** a lockfile entry's original asset name (from the key) has no matching asset in its source registry
- **THEN** the system skips that asset, shows a warning, and continues syncing the rest

#### Scenario: Sync completes
- **WHEN** all unsynced assets have been processed
- **THEN** the system shows a summary of installed, skipped, and orphaned assets, and refreshes the lockfile state

### Requirement: Migrate v1 lockfile to v2 on read
The system SHALL automatically migrate a v1 lockfile to v2 format on first read, without requiring user action.

#### Scenario: v1 lockfile detected
- **WHEN** `readLockfile()` reads a file with `version: 1`
- **THEN** the system derives a registry name from the old `registry` URL, rekeys all `installed` entries to `"registry:type:name"` format, backfills `registryUrl` on each `InstalledAsset`, populates `registries[]`, writes a backup at `ai-stash.lock.json.v1.bak`, and writes the migrated v2 lockfile

#### Scenario: Registry name derivation during migration
- **WHEN** the old `lockfile.registry` URL matches a URL already in the project's `registries[]` (unlikely on first migration but possible)
- **THEN** the system uses the matching registry's name as the key prefix

#### Scenario: Registry name fallback during migration
- **WHEN** the old `lockfile.registry` URL does not match any configured registry
- **THEN** the system uses the URL string itself as the registry name in the key, and adds it to `registries[]` with a generated name derived from the URL hostname
