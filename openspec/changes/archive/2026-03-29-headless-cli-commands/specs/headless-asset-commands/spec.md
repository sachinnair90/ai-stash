## ADDED Requirements

### Requirement: Install asset via headless add command
The system SHALL install an asset by type and name from a configured registry when the user runs `ai-stash add <type> <name>`, without launching the TUI. Default scope SHALL be `project` and default targets SHALL be all targets listed in the asset's `targets` field.

#### Scenario: Add from single configured registry
- **WHEN** exactly one registry is configured and the user runs `ai-stash add skill git-commit`
- **THEN** the system fetches the skill from that registry, installs it at project scope, and prints confirmation

#### Scenario: Add with explicit registry flag
- **WHEN** the user runs `ai-stash add skill git-commit --registry acme`
- **THEN** the system uses the registry named `acme`, ignoring other configured registries

#### Scenario: Add from unknown registry name
- **WHEN** the user runs `ai-stash add skill git-commit --registry nonexistent`
- **THEN** the system prints an error "no registry named 'nonexistent' configured" and exits with code 1

#### Scenario: Add with custom scope
- **WHEN** the user runs `ai-stash add skill git-commit --scope global`
- **THEN** the system installs the skill to the global scope directory

#### Scenario: Add with custom targets
- **WHEN** the user runs `ai-stash add skill git-commit --target claude-code`
- **THEN** the system installs only for the `claude-code` target

#### Scenario: Asset not found in registry
- **WHEN** the user runs `ai-stash add skill nonexistent`
- **THEN** the system prints "skill 'nonexistent' not found in registry 'community'" and exits with code 1

#### Scenario: Already installed at same version (no-op)
- **WHEN** the asset is already installed at the same version recorded in the lockfile
- **THEN** the system prints "already installed (1.0.0), nothing to do" and exits with code 0 without modifying any files

#### Scenario: Already installed at different version
- **WHEN** the asset is already installed at a different version
- **THEN** the system prints "already installed (1.0.0), use 'update' to upgrade" and exits with code 0

### Requirement: Resolve registry automatically when none specified
The system SHALL select the appropriate registry automatically when `--registry` is not supplied, using TTY detection to choose between a prompt and a silent selection.

#### Scenario: No registries configured
- **WHEN** no registries are configured and the user runs a headless asset command
- **THEN** the system prints "no registries configured. Run: ai-stash registry add <url> --name <name>" and exits with code 1

#### Scenario: Single registry — silent selection
- **WHEN** exactly one registry is configured and no `--registry` flag is given
- **THEN** the system uses the single registry without printing any selection notice

#### Scenario: Multiple registries in interactive terminal
- **WHEN** two or more registries are configured, stdout is a TTY, and no `--registry` flag is given
- **THEN** the system displays a numbered registry picker with the first registry as the default selection, and proceeds with the user's choice

#### Scenario: Multiple registries in non-interactive context
- **WHEN** two or more registries are configured, stdout is not a TTY, and no `--registry` flag is given
- **THEN** the system auto-selects the first registry, prints a warning to stderr "multiple registries configured, using '<name>'. Use --registry to be explicit.", and proceeds

### Requirement: Remove asset via headless remove command
The system SHALL remove an installed asset and its lockfile entry when the user runs `ai-stash remove <type> <name>`, without launching the TUI.

#### Scenario: Remove installed asset
- **WHEN** the user runs `ai-stash remove skill git-commit` and the asset is installed
- **THEN** the system deletes all files listed in the lockfile entry and removes the entry from the lockfile, then prints confirmation

#### Scenario: Remove asset not installed
- **WHEN** the user runs `ai-stash remove skill git-commit` and no matching entry exists in the lockfile
- **THEN** the system prints "skill 'git-commit' is not installed" and exits with code 1

### Requirement: Update asset via headless update command
The system SHALL update a specific installed asset or all installed assets when the user runs `ai-stash update <type> <name>` or `ai-stash update --all`, without launching the TUI.

#### Scenario: Update specific asset
- **WHEN** the user runs `ai-stash update skill git-commit` and a newer version is available
- **THEN** the system fetches and installs the new version, updates the lockfile entry, and prints the old → new version

#### Scenario: Update specific asset already up to date
- **WHEN** the user runs `ai-stash update skill git-commit` and the installed version matches the registry
- **THEN** the system prints "skill 'git-commit' already up to date (1.0.0)" and exits with code 0

#### Scenario: Update specific asset not installed
- **WHEN** the user runs `ai-stash update skill git-commit` and the asset is not in the lockfile
- **THEN** the system prints "skill 'git-commit' is not installed" and exits with code 1

#### Scenario: Update all assets
- **WHEN** the user runs `ai-stash update --all`
- **THEN** the system checks all installed assets for updates and upgrades each one that has a newer version, printing a per-asset result (updated / already up to date / skipped)

#### Scenario: Update all with no updates available
- **WHEN** the user runs `ai-stash update --all` and all assets are at the latest version
- **THEN** the system prints "all assets are up to date" and exits with code 0

### Requirement: List installed assets via headless list command
The system SHALL print a formatted table of all installed assets when the user runs `ai-stash list`, without launching the TUI.

#### Scenario: List with installed assets
- **WHEN** the user runs `ai-stash list` and at least one asset is installed
- **THEN** the system prints a table with columns TYPE, NAME, VERSION, SCOPE, REGISTRY showing one row per installed asset

#### Scenario: List with no assets installed
- **WHEN** the user runs `ai-stash list` and no assets are installed
- **THEN** the system prints "no assets installed" and exits with code 0

#### Scenario: List with no lockfile
- **WHEN** the user runs `ai-stash list` and no lockfile exists
- **THEN** the system prints "no assets installed" and exits with code 0

### Requirement: Sync missing assets via headless sync command
The system SHALL install all assets recorded in the lockfile but missing from disk when the user runs `ai-stash sync`, without launching the TUI.

#### Scenario: Sync restores missing assets
- **WHEN** the user runs `ai-stash sync` and one or more lockfile assets are missing from disk
- **THEN** the system installs each missing asset using its lockfile-recorded scope, targets, and registryUrl, printing per-asset progress

#### Scenario: Sync with all assets present
- **WHEN** the user runs `ai-stash sync` and all lockfile assets are present on disk
- **THEN** the system prints "all assets are in sync" and exits with code 0

#### Scenario: Sync skips orphaned assets
- **WHEN** the user runs `ai-stash sync` and some lockfile entries reference a registry name not in `registries[]`
- **THEN** the system skips those assets, prints a warning per orphaned asset, and continues syncing the rest

#### Scenario: Sync with no lockfile
- **WHEN** the user runs `ai-stash sync` and no lockfile exists
- **THEN** the system prints "no lockfile found, nothing to sync" and exits with code 0
