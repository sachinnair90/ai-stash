## MODIFIED Requirements

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
