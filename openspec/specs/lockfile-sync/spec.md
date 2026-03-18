### Requirement: Detect unsynced assets
The system SHALL compare the lockfile's installed entries against the local filesystem and identify assets whose files are not present on disk.

#### Scenario: All assets present
- **WHEN** every file listed in each lockfile entry exists on disk
- **THEN** the system reports zero unsynced assets

#### Scenario: Some assets missing
- **WHEN** one or more lockfile entries have a missing first file on disk
- **THEN** the system identifies those entries as unsynced

#### Scenario: No lockfile
- **WHEN** no `ai-stash.lock.json` is present in the project root
- **THEN** the system shows no unsynced badge and the sync shortcut does nothing

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
The system SHALL install all unsynced assets in batch using the scope and targets recorded in the lockfile, without prompting the user for those values.

#### Scenario: Confirm and sync
- **WHEN** the user confirms the sync operation in the Sync view
- **THEN** the system installs each unsynced asset using its lockfile-recorded scope and targets, showing per-asset progress

#### Scenario: Cancel sync
- **WHEN** the user cancels or presses Escape in the Sync view before confirming
- **THEN** no files are written and the user returns to the Browse view

#### Scenario: Asset not found in registry
- **WHEN** a lockfile entry has no matching asset in the current registry
- **THEN** the system skips that asset, shows a warning, and continues syncing the rest

#### Scenario: Sync completes
- **WHEN** all unsynced assets have been processed
- **THEN** the system shows a summary of installed and skipped assets and refreshes the lockfile state
