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
The system SHALL prompt the user to choose between project-local and global installation for each asset, UNLESS the scope is provided programmatically (e.g. from a lockfile sync), in which case the prompt SHALL be skipped.

#### Scenario: Scope selection (interactive)
- **WHEN** the user initiates an install interactively
- **THEN** the system presents a choice between "project" (relative to current directory) and "global" (`~/.config/...`)

#### Scenario: Scope pre-supplied (sync)
- **WHEN** an install is triggered by the sync engine with a pre-resolved scope
- **THEN** the system skips the scope prompt and uses the supplied value

### Requirement: Choose target tools
The system SHALL allow the user to select which target tools to install for, defaulting to all compatible targets, UNLESS targets are provided programmatically (e.g. from a lockfile sync), in which case the prompt SHALL be skipped.

#### Scenario: Multi-target selection (interactive)
- **WHEN** the user installs an asset interactively
- **THEN** the system presents checkboxes for each compatible target, all checked by default

#### Scenario: Targets pre-supplied (sync)
- **WHEN** an install is triggered by the sync engine with pre-resolved targets
- **THEN** the system skips the target prompt and installs for the supplied targets

#### Scenario: Single-target asset
- **WHEN** the asset supports only one target tool
- **THEN** the system skips target selection and installs for that tool

### Requirement: Detect conflicts
The system SHALL check for existing files at the target install paths before writing, and offer merge/overwrite/skip options when conflicts are found. Additionally, the system SHALL detect cross-registry asset conflicts (same type and name, different registry) and apply the suffix rule rather than a file conflict prompt.

#### Scenario: Conflict with unmanaged file
- **WHEN** an install would overwrite a file not tracked in the lockfile
- **THEN** the system warns the user and presents options: overwrite, skip, or view diff

#### Scenario: Conflict with managed file
- **WHEN** an install would overwrite a file tracked in the lockfile from a previous install of the same asset from the same registry
- **THEN** the system treats it as an update and overwrites by default

#### Scenario: No conflict
- **WHEN** no files exist at the target paths and no cross-registry conflict exists
- **THEN** the system installs without prompting

#### Scenario: Cross-registry conflict triggers suffix
- **WHEN** an install detects that the same type and name is already installed from a different registry
- **THEN** the system installs the asset under a suffixed disk name without a file conflict prompt, and shows a post-install notice

### Requirement: Track installations in lockfile
The system SHALL record every installed asset in `ai-stash.lock.json` at the project root using a key of the format `"registry:type:name"`, where `registry` is the source registry's configured name, `type` is the asset type, and `name` is the original asset name in the registry. Each entry SHALL include type, version, targets, scope, installed files, timestamp, and `registryUrl`.

#### Scenario: Lockfile created on first install
- **WHEN** the user installs an asset and no lockfile exists (but a registry has been added)
- **THEN** the system creates `ai-stash.lock.json` with the installed asset entry keyed as `"registry:type:name"`

#### Scenario: Lockfile updated on subsequent install
- **WHEN** the user installs another asset and a lockfile exists
- **THEN** the system adds the new entry using the `"registry:type:name"` key format

#### Scenario: Lockfile records registryUrl
- **WHEN** an asset is installed
- **THEN** the lockfile entry includes `registryUrl` set to the fetch URL of the source registry at install time

#### Scenario: Lockfile records all placed files
- **WHEN** an asset is installed to multiple targets
- **THEN** the lockfile entry lists every file path that was written, including suffixed paths when a conflict suffix was applied

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
