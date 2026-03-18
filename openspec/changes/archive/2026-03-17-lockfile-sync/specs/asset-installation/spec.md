## MODIFIED Requirements

### Requirement: Choose install scope
The system SHALL prompt the user to choose between project-local and global installation for each asset, UNLESS the scope is provided programmatically (e.g. from a lockfile sync), in which case the prompt SHALL be skipped.

#### Scenario: Scope selection (interactive)
- **WHEN** the user initiates an install interactively
- **THEN** the system presents a choice between "project" and "global"

#### Scenario: Scope pre-supplied (sync)
- **WHEN** an install is triggered by the sync engine with a pre-resolved scope
- **THEN** the system skips the scope prompt and uses the supplied value

### Requirement: Choose target tools
The system SHALL allow the user to select which target tools to install for, UNLESS targets are provided programmatically (e.g. from a lockfile sync), in which case the prompt SHALL be skipped.

#### Scenario: Multi-target selection (interactive)
- **WHEN** the user installs an asset interactively
- **THEN** the system presents checkboxes for each compatible target

#### Scenario: Targets pre-supplied (sync)
- **WHEN** an install is triggered by the sync engine with pre-resolved targets
- **THEN** the system skips the target prompt and installs for the supplied targets
