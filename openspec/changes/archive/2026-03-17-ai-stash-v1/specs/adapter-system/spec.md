## ADDED Requirements

### Requirement: Pluggable adapter interface
The system SHALL define a common adapter interface that all target tool adapters implement, providing methods for path resolution, file transformation, and installation.

#### Scenario: Adapter interface contract
- **WHEN** a new adapter is created
- **THEN** it MUST implement: `getInstallPath(asset, scope)`, `transformFiles(asset, files)`, `mergeIntoExisting(asset, existingContent)`, and `removeAsset(asset, lockfileEntry)`

### Requirement: Adapter resolves install paths
Each adapter SHALL determine the correct file system paths for a given asset type and install scope (project vs global).

#### Scenario: Project-scope path resolution
- **WHEN** the adapter is asked for the install path of a skill at project scope
- **THEN** it returns the correct project-relative path for that target tool

#### Scenario: Global-scope path resolution
- **WHEN** the adapter is asked for the install path of a skill at global scope
- **THEN** it returns the correct absolute path under the user's home directory

### Requirement: Adapter transforms files
Each adapter SHALL transform asset files from the canonical (Claude Code) format to the target tool's format when needed.

#### Scenario: No transformation needed
- **WHEN** the canonical format matches the target format (e.g., skills)
- **THEN** the adapter returns files unchanged

#### Scenario: Transformation needed
- **WHEN** the canonical format differs from the target format (e.g., agents, prompts)
- **THEN** the adapter transforms frontmatter fields, file extensions, and content as needed

### Requirement: Adapter handles merge operations
Each adapter SHALL handle merging asset content into existing files when the target tool uses shared files (e.g., instructions into CLAUDE.md, hooks into settings.json).

#### Scenario: Merge with section markers
- **WHEN** an instruction asset is installed into an existing CLAUDE.md
- **THEN** the adapter inserts the content wrapped in `<!-- ai-stash:{name} -->` / `<!-- /ai-stash:{name} -->` markers

#### Scenario: Update merged section
- **WHEN** a previously-merged asset is updated
- **THEN** the adapter replaces only the content between the asset's section markers

### Requirement: Adapter registry
The system SHALL maintain a registry of available adapters, keyed by target tool identifier (e.g., "claude-code", "copilot"), allowing lookup by name.

#### Scenario: Look up adapter
- **WHEN** the system needs to install an asset for "copilot"
- **THEN** it retrieves the Copilot adapter from the adapter registry by name
