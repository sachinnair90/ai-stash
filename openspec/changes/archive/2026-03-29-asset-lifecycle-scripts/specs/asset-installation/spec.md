## ADDED Requirements

### Requirement: Fetch and parse manifest for folder-based assets
During installation, the system SHALL fetch `manifest.json` from the asset folder before fetching any content files, and SHALL resolve the full file list, userConfig, scripts, and configuredFiles from the manifest.

#### Scenario: Manifest parsed before file fetch
- **WHEN** the user installs a folder-based asset (hook, mcp-server, or plugin)
- **THEN** the engine fetches `manifest.json` first, then fetches only the files listed in `manifest.files`

### Requirement: Collect userConfig before writing files
The system SHALL prompt for all declared userConfig values before writing any files to disk. File writing SHALL NOT begin until all required values have been collected.

#### Scenario: Prompts precede file writes
- **WHEN** a folder-based asset with `userConfig` is installed
- **THEN** all prompts are shown and completed before the first file is written

### Requirement: Auto-gitignore configuredFiles at install time
The system SHALL append each path in `manifest.configuredFiles` to the project or global `.gitignore` after file installation, and SHALL NOT add those paths to the lockfile `files[]`.

#### Scenario: configuredFiles added to .gitignore
- **WHEN** a folder-based asset with `configuredFiles` is installed at project scope
- **THEN** each path in `configuredFiles` is appended to `.gitignore` in the project root (no duplicates added)

#### Scenario: configuredFiles excluded from lockfile tracking
- **WHEN** a folder-based asset with `configuredFiles` is installed
- **THEN** the lockfile entry's `files[]` does NOT include any path listed in `configuredFiles`

#### Scenario: .setup-complete auto-added to configuredFiles
- **WHEN** a folder-based asset with `scripts.postInstall` is installed
- **THEN** `.setup-complete` is treated as a configuredFile regardless of whether the author declared it

## MODIFIED Requirements

### Requirement: Track installations in lockfile
The system SHALL record every installed asset in `ai-stash.lock.json` at the project root using a key of the format `"registry:type:name"`, where `registry` is the source registry's configured name, `type` is the asset type, and `name` is the original asset name in the registry. Each entry SHALL include type, version, targets, scope, installed files (excluding configuredFiles), timestamp, and `registryUrl`. For folder-based assets, the entry SHALL additionally record `hasManifest: true` to enable manifest-aware behaviours on update and remove.

#### Scenario: Lockfile created on first install
- **WHEN** the user installs an asset and no lockfile exists (but a registry has been added)
- **THEN** the system creates `ai-stash.lock.json` with the installed asset entry keyed as `"registry:type:name"`

#### Scenario: Lockfile updated on subsequent install
- **WHEN** the user installs another asset and a lockfile exists
- **THEN** the system adds the new entry using the `"registry:type:name"` key format

#### Scenario: Lockfile records registryUrl
- **WHEN** an asset is installed
- **THEN** the lockfile entry includes `registryUrl` set to the fetch URL of the source registry at install time

#### Scenario: Lockfile records all placed files excluding configuredFiles
- **WHEN** an asset is installed to multiple targets
- **THEN** the lockfile entry lists every file path that was written, excluding any path in `configuredFiles`

#### Scenario: Lockfile records hasManifest for folder-based assets
- **WHEN** a folder-based asset is installed
- **THEN** the lockfile entry includes `hasManifest: true`
