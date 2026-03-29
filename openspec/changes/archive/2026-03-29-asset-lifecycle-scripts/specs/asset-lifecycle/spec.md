## MODIFIED Requirements

### Requirement: Update individual asset
The system SHALL allow the user to update a single installed asset to the latest registry version. For folder-based assets, the update SHALL re-fetch `manifest.json`, detect any newly declared userConfig keys not yet collected, prompt for them, and preserve existing configuredFiles (not overwrite them).

#### Scenario: Successful update
- **WHEN** the user selects an asset to update
- **THEN** the system fetches the new version, replaces the installed files (excluding configuredFiles), and updates the lockfile entry

#### Scenario: Update preserves targets
- **WHEN** an asset was installed for both Claude Code and Copilot
- **THEN** the update replaces files for all originally-installed targets

#### Scenario: Update preserves configuredFiles
- **WHEN** a folder-based asset with configuredFiles is updated
- **THEN** the engine does not overwrite any file listed in `manifest.configuredFiles`

#### Scenario: Update prompts for new userConfig keys
- **WHEN** the updated manifest declares a userConfig key not present in the user's stored config
- **THEN** the engine prompts for the new value before writing files

### Requirement: Remove installed asset
The system SHALL cleanly remove an installed asset by deleting all files it placed and removing its lockfile entry. For folder-based assets, the system SHALL read `manifest.json` from the installed folder before deletion to determine if a postUninstall notice is needed.

#### Scenario: Remove skill
- **WHEN** the user removes an installed skill
- **THEN** the system deletes the skill directory from all target tool locations and removes the lockfile entry

#### Scenario: Remove from merged file
- **WHEN** the user removes an instruction asset that was merged into CLAUDE.md via section markers
- **THEN** the system removes the marked section from CLAUDE.md and removes the lockfile entry

#### Scenario: Remove confirms before deleting
- **WHEN** the user initiates removal
- **THEN** the system shows which files will be deleted and asks for confirmation before proceeding

#### Scenario: Remove surfaces postUninstall notice
- **WHEN** the user removes a folder-based asset whose manifest declares `scripts.postUninstall`
- **THEN** after files are deleted, the system prints a notice with the script path and the command to run it for cleanup

#### Scenario: Remove does not prompt for assets without postUninstall
- **WHEN** the user removes an asset with no `scripts.postUninstall`
- **THEN** no script notice is shown after removal

### Requirement: Update all assets
The system SHALL provide a bulk update option to update all assets with available updates.

#### Scenario: Bulk update
- **WHEN** the user triggers "update all"
- **THEN** the system updates each outdated asset sequentially, showing progress for each, collecting any newly required userConfig inline, and preserving configuredFiles for each
