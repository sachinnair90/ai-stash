## MODIFIED Requirements

### Requirement: Registry index format
The system SHALL expect `registry.json` to conform to a versioned schema with a `version` field, `generatedAt` timestamp, and typed top-level buckets (`skills`, `agents`, `instructions`, `prompts`, `hooks`), each containing an array of assets of that type.

#### Scenario: Valid registry.json
- **WHEN** the fetched `registry.json` has `version: 1` and valid typed buckets
- **THEN** the system parses it successfully, flattens all buckets into a unified asset catalog (injecting the `type` field from the bucket key), and makes all assets available for browsing and installation

#### Scenario: Unknown version
- **WHEN** the fetched `registry.json` has a `version` higher than the tool supports
- **THEN** the system displays a warning suggesting the user update `ai-stash` and attempts to parse what it can

#### Scenario: Empty bucket
- **WHEN** a typed bucket (e.g. `hooks`) is absent or an empty array in `registry.json`
- **THEN** the system treats that type as having zero assets and does not error

### Requirement: Fetch individual asset files
The system SHALL fetch individual asset files from the registry on demand during installation, using each entry in the asset's `files` array as a registry-root-relative path.

#### Scenario: Fetch asset files for install
- **WHEN** the user selects an asset to install
- **THEN** the system fetches all files listed in the asset's `files` array by resolving each entry against the registry base URL (e.g. `{registryBaseUrl}/skills/foo/main.md`)

#### Scenario: Show download progress
- **WHEN** asset files are being fetched
- **THEN** the system displays a progress indicator showing the current download status
