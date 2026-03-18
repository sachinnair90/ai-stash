## MODIFIED Requirements

### Requirement: Filter by asset type
The system SHALL allow filtering the asset list by type: `skills`, `agents`, `instructions`, `commands`, `hooks`, `plugins`, `mcp-servers`.

#### Scenario: Filter to commands only
- **WHEN** the user selects the "commands" type filter
- **THEN** the list shows only assets with `type: "command"` and the active filter is visually indicated

#### Scenario: Filter to plugins only
- **WHEN** the user selects the "plugins" type filter
- **THEN** the list shows only assets with `type: "plugin"` and the active filter is visually indicated

#### Scenario: Filter to MCP servers only
- **WHEN** the user selects the "mcp-servers" type filter
- **THEN** the list shows only assets with `type: "mcp-server"` and the active filter is visually indicated

#### Scenario: Clear filter
- **WHEN** the user clears the type filter
- **THEN** all assets are shown again

### Requirement: Color-coded asset types
The system SHALL display asset types with distinct colors for quick visual identification.

#### Scenario: Type badges
- **WHEN** assets are displayed in the list
- **THEN** each asset's type is shown as a colored badge using the following scheme: `skill`=green, `agent`=blue, `instruction`=yellow, `hook`=red, `command`=purple, `plugin`=cyan, `mcp-server`=orange
