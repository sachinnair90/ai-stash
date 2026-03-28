## ADDED Requirements

### Requirement: Detect cross-registry install conflicts
The system SHALL detect a conflict when the user installs an asset whose type and name match an entry already in `installed` that was sourced from a different registry.

#### Scenario: Same type and name, different registry — conflict
- **WHEN** the user installs a `skill` named `git-commit` from registry `acme` and `installed["community:skill:git-commit"]` already exists
- **THEN** the system detects a conflict and applies the suffix rule

#### Scenario: Same type and name, same registry — no conflict
- **WHEN** the user installs a `skill` named `git-commit` from registry `community` and `installed["community:skill:git-commit"]` already exists
- **THEN** the system treats it as a reinstall/update and proceeds without suffix

#### Scenario: Same name, different type — no conflict
- **WHEN** the user installs a `command` named `git-commit` and `installed["community:skill:git-commit"]` exists
- **THEN** the system detects no conflict and installs with the clean name

### Requirement: Suffix conflicting asset disk name on install
When a conflict is detected, the system SHALL install the incoming asset under a suffixed disk name (`name-registryname`) while recording the lockfile key using the original registry name and asset name.

#### Scenario: Conflicting skill installed with suffix
- **WHEN** a conflict is detected for `skill` `git-commit` from registry `acme`
- **THEN** the system installs files to `.claude/skills/git-commit-acme/` and records the lockfile key as `"acme:skill:git-commit"`

#### Scenario: Lockfile key uses original name, files encode suffix
- **WHEN** a suffixed asset is installed
- **THEN** `installed["acme:skill:git-commit"].files` contains the suffixed paths (e.g., `.claude/skills/git-commit-acme/main.md`) and the key itself contains the original name

#### Scenario: Post-install notice on suffix
- **WHEN** an asset is installed with a suffix
- **THEN** the system displays a notice: the asset name, the suffix applied, and the reason (which asset from which registry already occupies the clean name)

### Requirement: Show orphaned assets in Installed view
The system SHALL identify and visually distinguish installed assets whose registry name (from the lockfile key) is not present in `registries[]`.

#### Scenario: Registry removed after install
- **WHEN** a registry is removed from `registries[]` and assets remain in `installed` keyed under its name
- **THEN** the Installed view shows those assets with a ⚠ indicator and the label "registry '<name>' not configured"

#### Scenario: Registry name typo in lockfile
- **WHEN** a lockfile key references a registry name that does not match any entry in `registries[]`
- **THEN** the asset is treated as orphaned and shown with the ⚠ indicator

### Requirement: Skip orphaned assets during update and sync
The system SHALL skip orphaned assets during update checks and sync operations, as their source registry URL is unavailable.

#### Scenario: Update skips orphaned asset
- **WHEN** `checkUpdates()` encounters an asset whose registry name is not in `registries[]`
- **THEN** the system skips that asset and does not report it as having an available update

#### Scenario: Sync skips orphaned asset
- **WHEN** `syncFromLockfile()` encounters an orphaned asset
- **THEN** the system skips it, reports it as skipped with reason "registry not configured", and continues syncing the rest

### Requirement: Remove works for orphaned assets
The system SHALL allow removal of orphaned assets since the files are still on disk regardless of registry availability.

#### Scenario: Remove orphaned asset
- **WHEN** the user initiates removal of an orphaned asset
- **THEN** the system deletes the files listed in `InstalledAsset.files` and removes the lockfile entry, without contacting the registry
