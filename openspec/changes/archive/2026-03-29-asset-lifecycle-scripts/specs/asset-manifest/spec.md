## ADDED Requirements

### Requirement: Folder-based asset structure
The system SHALL support a `folder` field on registry entries for hooks, mcp-servers, and plugins. When `folder` is present, the engine SHALL fetch `{folder}/manifest.json` as the first step of installation to obtain the asset's file list, userConfig, scripts, and configuredFiles declarations.

#### Scenario: Engine fetches manifest for folder-based asset
- **WHEN** a registry entry has a `folder` field
- **THEN** the engine fetches `{folder}/manifest.json` before fetching any asset files

#### Scenario: Engine falls back to files[] for non-folder assets
- **WHEN** a registry entry has a `file` or `files[]` field and no `folder` field
- **THEN** the engine uses the existing fetch path without attempting to fetch a manifest

#### Scenario: Missing manifest.json is a fatal install error
- **WHEN** a registry entry has a `folder` field but `manifest.json` does not exist at that path
- **THEN** the engine aborts the install and surfaces a clear error message

### Requirement: manifest.json schema
A valid `manifest.json` for a folder-based asset SHALL declare: a `files` array (registry-root-relative paths of asset files to install), and MAY declare `userConfig` (named config values to collect), `scripts` (postInstall and/or postUninstall script filenames), and `configuredFiles` (paths of files produced by substitution or scripts that must be gitignored).

#### Scenario: Manifest with only files
- **WHEN** a `manifest.json` declares only a `files` array
- **THEN** the engine installs those files normally with no config prompts or script notices

#### Scenario: Manifest with userConfig and scripts
- **WHEN** a `manifest.json` declares both `userConfig` and `scripts.postInstall`
- **THEN** the engine collects userConfig values, performs substitution, installs files, and surfaces the postInstall script notice

#### Scenario: Manifest with configuredFiles
- **WHEN** a `manifest.json` declares a `configuredFiles` array
- **THEN** the engine adds each path in `configuredFiles` to `.gitignore` at install time and excludes them from the lockfile's `files[]`

### Requirement: Registry entry format migration for complex assets
The system SHALL support `file` (single-file simple assets) and `folder` (folder-based complex assets) as first-class fields on `RegistryAsset`. The existing `files[]` array SHALL remain supported for backward compatibility. Hooks, mcp-servers, and plugins in the canonical registry SHALL use the `folder` field.

#### Scenario: Simple asset uses file field
- **WHEN** a skill, agent, instruction, or command entry uses a `file` field
- **THEN** the engine fetches that single file and installs it

#### Scenario: Complex asset uses folder field
- **WHEN** a hook, mcp-server, or plugin entry uses a `folder` field
- **THEN** the engine fetches the manifest and derives the file list from it

#### Scenario: Legacy files[] entry still installs correctly
- **WHEN** a registry entry has `files[]` and no `file` or `folder` field
- **THEN** the engine installs it using the existing flat-file path without errors
