## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Cache registry locally (custom TTL)
**Reason:** The config file (`~/.config/ai-stash/config.json`) that stored `cacheTTL` is eliminated. The TTL is hardcoded to 3600 seconds.
**Migration:** No user action required. The default value (3600s) is unchanged; users who had a custom TTL will revert to 3600s.
