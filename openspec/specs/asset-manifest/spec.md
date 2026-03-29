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

### Requirement: scriptHashes in InstalledAsset lockfile type

The `InstalledAsset` type SHALL support an optional `scriptHashes` field containing sha256 hex digests of installed script contents keyed by script role (`postInstall`, `postUninstall`).

#### Scenario: scriptHashes present for scripted asset

- **WHEN** a scripted asset is written to the lockfile
- **THEN** the lockfile entry has a `scriptHashes` object with keys for each declared script

#### Scenario: scriptHashes absent for non-scripted asset

- **WHEN** a non-scripted asset is written to the lockfile
- **THEN** the lockfile entry has no `scriptHashes` field

### Requirement: riskAccepted and riskAcceptedAt in InstalledAsset lockfile type

The `InstalledAsset` type SHALL support optional `riskAccepted: boolean` and `riskAcceptedAt: string` (ISO 8601) fields to track developer acknowledgment of script risks.

#### Scenario: riskAccepted set after disclaimer acceptance

- **WHEN** the developer accepts the risk disclaimer and the asset is installed
- **THEN** the lockfile entry has `riskAccepted: true` and `riskAcceptedAt` set to the current ISO timestamp

#### Scenario: riskAccepted absent for non-scripted asset

- **WHEN** an asset with no scripts is installed
- **THEN** the lockfile entry has no `riskAccepted` or `riskAcceptedAt` fields

#### Scenario: Existing lockfile entries without riskAccepted are valid

- **WHEN** the lockfile contains entries from a previous version of ai-stash that lack `riskAccepted`
- **THEN** the engine treats these as not-yet-reviewed and shows the disclaimer on the next install or update of that asset

### Requirement: riskAccepted preserved by syncFromLockfile

The system SHALL preserve existing `riskAccepted` and `riskAcceptedAt` values when reinstalling an asset via `syncFromLockfile`. Sync does not prompt the developer again — the prior acceptance is carried forward onto the new lockfile entry.

#### Scenario: Sync preserves prior risk acceptance

- **WHEN** `ai-stash sync` reinstalls a scripted asset that has `riskAccepted: true` in the lockfile
- **THEN** the reinstalled lockfile entry retains `riskAccepted: true` and the original `riskAcceptedAt` timestamp

#### Scenario: Sync with no prior acceptance does not prompt

- **WHEN** `ai-stash sync` reinstalls a scripted asset that has no `riskAccepted` in the lockfile
- **THEN** no disclaimer is shown during sync; the lockfile entry is written without `riskAccepted`, and the disclaimer will appear on the next explicit install or update
