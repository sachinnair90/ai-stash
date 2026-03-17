## MODIFIED Requirements

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
