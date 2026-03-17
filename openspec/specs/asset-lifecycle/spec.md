### Requirement: Check for updates
The system SHALL compare installed asset versions (from lockfile) against the registry and identify assets with newer versions available.

#### Scenario: Updates available
- **WHEN** the user opens the TUI and installed assets have newer registry versions
- **THEN** the system indicates which assets have updates available with old and new version numbers

#### Scenario: All up to date
- **WHEN** all installed assets match their registry versions
- **THEN** the system indicates that everything is up to date

### Requirement: Update individual asset
The system SHALL allow the user to update a single installed asset to the latest registry version.

#### Scenario: Successful update
- **WHEN** the user selects an asset to update
- **THEN** the system fetches the new version, replaces the installed files, and updates the lockfile entry

#### Scenario: Update preserves targets
- **WHEN** an asset was installed for both Claude Code and Copilot
- **THEN** the update replaces files for all originally-installed targets

### Requirement: Update all assets
The system SHALL provide a bulk update option to update all assets with available updates.

#### Scenario: Bulk update
- **WHEN** the user triggers "update all"
- **THEN** the system updates each outdated asset sequentially, showing progress for each

### Requirement: Remove installed asset
The system SHALL cleanly remove an installed asset by deleting all files it placed and removing its lockfile entry.

#### Scenario: Remove skill
- **WHEN** the user removes an installed skill
- **THEN** the system deletes the skill directory from all target tool locations and removes the lockfile entry

#### Scenario: Remove from merged file
- **WHEN** the user removes an instruction asset that was merged into CLAUDE.md via section markers
- **THEN** the system removes the marked section from CLAUDE.md and removes the lockfile entry

#### Scenario: Remove confirms before deleting
- **WHEN** the user initiates removal
- **THEN** the system shows which files will be deleted and asks for confirmation before proceeding

### Requirement: List installed assets
The system SHALL display all currently installed assets with their version, scope, and target tools.

#### Scenario: Show installed
- **WHEN** the user views the installed assets list
- **THEN** the system reads the lockfile and displays each asset's name, type, version, scope, and targets
