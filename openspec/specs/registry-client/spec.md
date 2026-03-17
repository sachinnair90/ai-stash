### Requirement: Fetch registry index
The system SHALL fetch `registry.json` from the configured registry URL (GitHub raw content or API) and parse it into a typed asset catalog.

#### Scenario: Successful fetch
- **WHEN** the TUI starts and the cache is expired or missing
- **THEN** the system fetches `registry.json` from the registry URL and makes the asset catalog available for browsing

#### Scenario: Network failure with valid cache
- **WHEN** the network request fails and a cached `registry.json` exists
- **THEN** the system uses the cached data and displays a warning indicating the cache age

#### Scenario: Network failure with no cache
- **WHEN** the network request fails and no cached data exists
- **THEN** the system displays an error message explaining that the registry is unreachable and no cached data is available

### Requirement: Cache registry locally
The system SHALL cache the fetched `registry.json` at `~/.config/ai-stash/cache/registry.json` with a configurable TTL (default: 3600 seconds).

#### Scenario: Cache is fresh
- **WHEN** the TUI starts and the cached `registry.json` is younger than the configured TTL
- **THEN** the system uses the cached data without making a network request

#### Scenario: Cache is expired
- **WHEN** the TUI starts and the cached `registry.json` is older than the configured TTL
- **THEN** the system fetches a fresh copy from the registry URL

#### Scenario: Custom TTL
- **WHEN** the user has set `cacheTTL` in `~/.config/ai-stash/config.json`
- **THEN** the system uses that value (in seconds) instead of the default 3600

### Requirement: Fetch individual asset files
The system SHALL fetch individual asset files from the registry on demand during installation, using the asset's `path` field from `registry.json`.

#### Scenario: Fetch asset files for install
- **WHEN** the user selects an asset to install
- **THEN** the system fetches all files listed in the asset's `files` array from `{registryUrl}/{assetPath}/{filename}`

#### Scenario: Show download progress
- **WHEN** asset files are being fetched
- **THEN** the system displays a progress indicator showing the current download status

### Requirement: Registry index format
The system SHALL expect `registry.json` to conform to a versioned schema with a `version` field, `generatedAt` timestamp, and `assets` array.

#### Scenario: Valid registry.json
- **WHEN** the fetched `registry.json` has `version: 1` and a valid `assets` array
- **THEN** the system parses it successfully and makes all assets available

#### Scenario: Unknown version
- **WHEN** the fetched `registry.json` has a `version` higher than the tool supports
- **THEN** the system displays a warning suggesting the user update `ai-stash` and attempts to parse what it can
