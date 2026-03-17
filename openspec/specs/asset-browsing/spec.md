### Requirement: Display asset list
The system SHALL display a navigable list of all assets from the registry, showing each asset's name, type, description, and version.

#### Scenario: Browse all assets
- **WHEN** the TUI launches and the registry is loaded
- **THEN** the system displays a scrollable list of all assets with name, type badge, description, and version

#### Scenario: Empty registry
- **WHEN** the registry contains no assets
- **THEN** the system displays a message indicating no assets are available

### Requirement: Filter by asset type
The system SHALL allow filtering the asset list by type (skills, agents, instructions, hooks, prompts).

#### Scenario: Filter to skills only
- **WHEN** the user selects the "skills" type filter
- **THEN** the list shows only assets with `type: "skill"` and the active filter is visually indicated

#### Scenario: Clear filter
- **WHEN** the user clears the type filter
- **THEN** all assets are shown again

### Requirement: Filter by target tool
The system SHALL allow filtering assets by target tool (claude-code, copilot).

#### Scenario: Filter to Copilot-compatible
- **WHEN** the user selects the "copilot" target filter
- **THEN** the list shows only assets whose `targets` array includes "copilot"

### Requirement: Live search
The system SHALL provide a text input for live search that filters assets as the user types, matching against name, description, and tags.

#### Scenario: Search by name
- **WHEN** the user types "docx" in the search field
- **THEN** the list immediately filters to show only assets whose name, description, or tags contain "docx"

#### Scenario: Clear search
- **WHEN** the user clears the search field
- **THEN** the full asset list (with any active type/target filters) is restored

### Requirement: Preview asset content
The system SHALL display a preview pane alongside the asset list showing the content of the currently highlighted asset.

#### Scenario: Preview skill
- **WHEN** the user highlights a skill asset in the list
- **THEN** the preview pane shows the SKILL.md content (frontmatter + body)

#### Scenario: Preview agent
- **WHEN** the user highlights an agent asset
- **THEN** the preview pane shows the agent markdown content

### Requirement: Multi-select for bulk install
The system SHALL allow selecting multiple assets for bulk installation.

#### Scenario: Select multiple assets
- **WHEN** the user toggles selection on multiple assets using a keyboard shortcut
- **THEN** the selected assets are visually marked and a count of selected items is displayed

#### Scenario: Install selected
- **WHEN** the user confirms installation of selected assets
- **THEN** all selected assets are installed in sequence

### Requirement: Color-coded asset types
The system SHALL display asset types with distinct colors for quick visual identification.

#### Scenario: Type badges
- **WHEN** assets are displayed in the list
- **THEN** each asset's type is shown as a colored badge (e.g., skills=green, agents=blue, instructions=yellow, hooks=red, prompts=purple)

### Requirement: Keyboard shortcut help
The system SHALL display a footer with available keyboard shortcuts and support a help key (?) for full shortcut reference.

#### Scenario: Help footer
- **WHEN** the TUI is active
- **THEN** a footer displays the most common keyboard shortcuts (navigate, select, search, filter, install, quit)

#### Scenario: Full help
- **WHEN** the user presses `?`
- **THEN** a help overlay displays all available keyboard shortcuts and their descriptions

### Requirement: Show install status
The system SHALL indicate which assets are already installed and their version status relative to the registry.

#### Scenario: Installed asset
- **WHEN** an asset in the list is tracked in the lockfile
- **THEN** it is marked as "installed" with a visual indicator

#### Scenario: Update available
- **WHEN** an installed asset has a newer version in the registry
- **THEN** it is marked as "update available" with the installed and available versions shown
