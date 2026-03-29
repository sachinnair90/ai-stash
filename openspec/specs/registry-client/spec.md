### Requirement: Fetch registry index
The system SHALL fetch `registry.json` from every URL in `lockfile.registries[]` (GitHub raw content or API) and merge the results into a unified typed asset catalog. Each asset in the catalog SHALL carry its source registry name.

#### Scenario: Successful fetch
- **WHEN** the TUI starts and the cache is expired or missing for one or more registries
- **THEN** the system fetches `registry.json` from each registry URL in parallel and merges all asset catalogs, making the combined catalog available for browsing

#### Scenario: Network failure with valid cache
- **WHEN** the network request for a registry fails and a cached `registry.json` exists for that registry
- **THEN** the system uses the cached data for that registry and displays a per-registry warning indicating the cache age

#### Scenario: Network failure with no cache
- **WHEN** the network request fails and no cached data exists for that registry
- **THEN** the system omits that registry's assets from the catalog and displays a per-registry error; other registries are unaffected

### Requirement: Cache registry locally
The system SHALL cache each registry's `registry.json` independently at `${XDG_CACHE_HOME:-~/.cache}/ai-stash/registry-<urlhash>.json` with a TTL of 3600 seconds, where `<urlhash>` is a short hash of the registry URL.

#### Scenario: Cache is fresh
- **WHEN** the TUI starts and the cached file for a registry is younger than 3600 seconds
- **THEN** the system uses the cached data for that registry without making a network request

#### Scenario: Cache is expired
- **WHEN** the TUI starts and the cached file for a registry is older than 3600 seconds
- **THEN** the system fetches a fresh copy from that registry URL

#### Scenario: Independent cache per registry
- **WHEN** one registry's cache is stale and another's is fresh
- **THEN** the system fetches only the stale registry and uses the cached data for the fresh one

### Requirement: Fetch individual asset files
The system SHALL fetch individual asset files from the registry on demand during installation, using each entry in the asset's `files` array as a registry-root-relative path.

#### Scenario: Fetch asset files for install
- **WHEN** the user selects an asset to install
- **THEN** the system fetches all files listed in the asset's `files` array by resolving each entry against the registry base URL (e.g. `{registryBaseUrl}/skills/foo/main.md`)

#### Scenario: Show download progress
- **WHEN** asset files are being fetched
- **THEN** the system displays a progress indicator showing the current download status

### Requirement: Registry index format
The system SHALL expect `registry.json` to conform to a versioned schema with a `version` field, `generatedAt` timestamp, and typed top-level buckets (`skills`, `agents`, `instructions`, `commands`, `hooks`, `plugins`, `mcpServers`), each containing an array of assets of that type. The `prompts` bucket is no longer supported.

#### Scenario: Valid registry.json with all buckets
- **WHEN** the fetched `registry.json` has `version: 1` and valid typed buckets including `commands`, `plugins`, and `mcpServers`
- **THEN** the system parses it successfully, flattens all buckets into a unified asset catalog injecting the `type` field (`commands` → `command`, `plugins` → `plugin`, `mcpServers` → `mcp-server`), and makes all assets available

#### Scenario: Legacy prompts bucket
- **WHEN** the fetched `registry.json` contains a `prompts` bucket (legacy format)
- **THEN** the system maps those assets to `type: "command"` for backwards compatibility

#### Scenario: Empty bucket
- **WHEN** a typed bucket (e.g. `plugins`) is absent or an empty array in `registry.json`
- **THEN** the system treats that type as having zero assets and does not error

#### Scenario: Unknown version
- **WHEN** the fetched `registry.json` has a `version` higher than the tool supports
- **THEN** the system displays a warning suggesting the user update `ai-stash` and attempts to parse what it can
