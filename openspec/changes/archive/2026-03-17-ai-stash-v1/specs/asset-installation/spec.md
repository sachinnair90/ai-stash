## ADDED Requirements

### Requirement: Install asset to target tools
The system SHALL install a selected asset to the correct file locations for each chosen target tool, using the appropriate adapter.

#### Scenario: Install skill for Claude Code
- **WHEN** the user installs a skill targeting Claude Code at project scope
- **THEN** the system copies the skill files to `.claude/skills/{name}/`

#### Scenario: Install skill for both tools
- **WHEN** the user installs a skill targeting both Claude Code and Copilot at project scope
- **THEN** the system copies files to `.claude/skills/{name}/` and `.github/skills/{name}/`

#### Scenario: Install at global scope
- **WHEN** the user chooses global scope for a skill install
- **THEN** the system copies files to `~/.claude/skills/{name}/` (and `~/.copilot/skills/{name}/` for Copilot)

### Requirement: Choose install scope
The system SHALL prompt the user to choose between project-local and global installation for each asset.

#### Scenario: Scope selection
- **WHEN** the user initiates an install
- **THEN** the system presents a choice between "project" (relative to current directory) and "global" (`~/.config/...`)

### Requirement: Choose target tools
The system SHALL allow the user to select which target tools to install for, defaulting to all compatible targets.

#### Scenario: Multi-target selection
- **WHEN** the user installs an asset that supports both Claude Code and Copilot
- **THEN** the system presents checkboxes for each compatible target, all checked by default

#### Scenario: Single-target asset
- **WHEN** the asset supports only one target tool
- **THEN** the system skips target selection and installs for that tool

### Requirement: Detect conflicts
The system SHALL check for existing files at the target install paths before writing, and offer merge/overwrite/skip options when conflicts are found.

#### Scenario: Conflict with unmanaged file
- **WHEN** an install would overwrite a file not tracked in the lockfile
- **THEN** the system warns the user and presents options: overwrite, skip, or view diff

#### Scenario: Conflict with managed file
- **WHEN** an install would overwrite a file tracked in the lockfile (from a previous install)
- **THEN** the system treats it as an update and overwrites by default

#### Scenario: No conflict
- **WHEN** no files exist at the target paths
- **THEN** the system installs without prompting

### Requirement: Track installations in lockfile
The system SHALL record every installed asset in `ai-stash.lock.json` at the project root, including name, type, version, targets, scope, installed files, and timestamp.

#### Scenario: Lockfile created on first install
- **WHEN** the user installs an asset and no lockfile exists
- **THEN** the system creates `ai-stash.lock.json` with the installed asset entry

#### Scenario: Lockfile updated on subsequent install
- **WHEN** the user installs another asset and a lockfile exists
- **THEN** the system adds the new entry to the existing lockfile

#### Scenario: Lockfile records all placed files
- **WHEN** an asset is installed to multiple targets
- **THEN** the lockfile entry lists every file path that was written

### Requirement: Non-destructive by default
The system SHALL never silently overwrite existing files. All write operations MUST be confirmed or predictable (managed files via lockfile).

#### Scenario: Dry-run mode
- **WHEN** the user requests a dry-run install
- **THEN** the system shows what files would be created/modified without writing anything

### Requirement: Show install progress
The system SHALL display progress feedback during installation, including file-level status.

#### Scenario: Multi-file install
- **WHEN** an asset with multiple files is being installed
- **THEN** the system shows each file being written with a progress indicator
