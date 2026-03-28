## ADDED Requirements

### Requirement: Store registries in lockfile
The system SHALL store the list of configured registries as a top-level `registries` array in `ai-stash.lock.json`, replacing the previous single `registry` string field. Each entry SHALL have a `name` (unique, human-readable identifier) and a `url`.

#### Scenario: Lockfile created with first registry
- **WHEN** no lockfile exists and the user adds their first registry
- **THEN** the system creates `ai-stash.lock.json` with `registries: [{ name, url }]` and `installed: {}`

#### Scenario: Registry added to existing lockfile
- **WHEN** a lockfile exists and the user adds a registry
- **THEN** the system appends the new registry to the `registries` array and writes the updated lockfile

#### Scenario: Duplicate registry URL rejected
- **WHEN** the user attempts to add a registry whose URL already exists in `registries[]`
- **THEN** the system rejects the addition and displays an error

#### Scenario: Duplicate registry name rejected
- **WHEN** the user attempts to add a registry whose name already exists in `registries[]`
- **THEN** the system rejects the addition and displays an error

### Requirement: Fetch assets from all configured registries
The system SHALL fetch the asset catalog from every registry in `registries[]` and present a unified, merged asset list to the user. Each asset in the merged list SHALL carry its source registry name.

#### Scenario: Single registry configured
- **WHEN** exactly one registry is configured
- **THEN** the system fetches and displays assets from that registry without modification

#### Scenario: Multiple registries configured
- **WHEN** two or more registries are configured
- **THEN** the system fetches all registries in parallel and merges their asset catalogs into one list, tagging each asset with its source registry name

#### Scenario: One registry unreachable
- **WHEN** one registry fails to fetch and no cache is available for it
- **THEN** the system displays assets from the remaining registries and shows a per-registry warning for the failed one

#### Scenario: No registries configured
- **WHEN** `registries[]` is empty
- **THEN** the system shows the SetupView prompting the user to add their first registry; the Browse view is not shown

### Requirement: Remove registry
The system SHALL allow the user to remove a registry from `registries[]`.

#### Scenario: Remove registry with no installed assets
- **WHEN** the user removes a registry that has no assets recorded in `installed`
- **THEN** the system removes the entry from `registries[]` and writes the updated lockfile

#### Scenario: Remove registry with installed assets
- **WHEN** the user removes a registry that has assets in `installed` keyed under its name
- **THEN** the system warns that N installed assets will become orphaned, requires confirmation, then removes the registry

### Requirement: Manage registries via CLI subcommands
The system SHALL expose registry management through non-TUI CLI subcommands for scripting and onboarding automation.

#### Scenario: Add registry via CLI
- **WHEN** the user runs `ai-stash registry add <url> --name <name>`
- **THEN** the system adds the registry to the lockfile and prints confirmation

#### Scenario: Remove registry via CLI
- **WHEN** the user runs `ai-stash registry remove <name>`
- **THEN** the system removes the registry (with orphan warning if applicable) and prints confirmation

#### Scenario: List registries via CLI
- **WHEN** the user runs `ai-stash registry list`
- **THEN** the system prints each configured registry's name, URL, and asset count

### Requirement: Manage registries via TUI Registries view
The system SHALL provide an interactive Registries view in the TUI, accessible via a key binding from the Browse view.

#### Scenario: Open Registries view
- **WHEN** the user presses `R` from the Browse view
- **THEN** the system navigates to the Registries view showing the list of configured registries with name, URL, and asset count

#### Scenario: Add registry from TUI
- **WHEN** the user presses `a` in the Registries view and submits a name and URL
- **THEN** the system adds the registry and refreshes the asset catalog

#### Scenario: Remove registry from TUI
- **WHEN** the user selects a registry and presses `d` in the Registries view
- **THEN** the system shows a confirmation prompt (with orphan warning if applicable) and removes the registry on confirm
