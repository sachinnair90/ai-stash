## ADDED Requirements

### Requirement: Spec-gate ceremony fires before feature implementation
The `spec-gate` ceremony SHALL be configured as a `before` ceremony in `.squad/ceremonies.md` that triggers when the Coordinator detects a new feature implementation request.

#### Scenario: Ceremony intercepts feature work
- **WHEN** the Coordinator receives a "new feature" or "build X" request
- **THEN** the spec-gate ceremony fires before any implementation agents are spawned
- **THEN** the Coordinator does not spawn implementation agents until the ceremony completes

### Requirement: Ceremony invokes the Speccer synchronously
The spec-gate ceremony SHALL spawn the Speccer agent in sync mode so the Coordinator waits for spec artifacts before routing implementation work.

#### Scenario: Speccer completes before routing begins
- **WHEN** the spec-gate ceremony fires
- **THEN** the Speccer is spawned synchronously
- **THEN** the Coordinator waits for the Speccer's output before proceeding to implementation routing

### Requirement: Ceremony gates on human approval of the proposal
After the Speccer produces OpenSpec artifacts, the ceremony SHALL pause and present the proposal summary to the developer for approval before proceeding.

#### Scenario: Developer approves proposal
- **WHEN** the Speccer has written `proposal.md`, `design.md`, `specs/`, and `tasks.md`
- **THEN** the Coordinator presents a summary of the proposal
- **THEN** the Coordinator waits for the developer's explicit approval
- **WHEN** the developer approves
- **THEN** the ceremony completes and the Coordinator proceeds to route `tasks.md`

#### Scenario: Developer requests changes to proposal
- **WHEN** the developer reviews the proposal and requests changes
- **THEN** the Speccer is re-invoked to revise the artifacts
- **THEN** the human gate is presented again after revision

### Requirement: Ceremony output feeds tasks.md into Coordinator routing
After approval, the ceremony SHALL surface the feature name, `tasks.md` path, and `specs/` directory path as ceremony output injected into the work batch spawn prompts.

#### Scenario: Implementors receive spec context
- **WHEN** the Coordinator spawns implementation agents after ceremony completion
- **THEN** each agent's spawn prompt includes the path to `openspec/changes/{feature}/specs/` as INPUT ARTIFACTS
- **THEN** each agent's spawn prompt references the openspec Squad skill

### Requirement: Spec-gate is skipped when spec already exists and is approved
If `openspec/changes/{feature}/` already contains a completed and approved spec, the ceremony SHALL pass through without re-invoking the Speccer.

#### Scenario: Existing spec skips ceremony
- **WHEN** the Coordinator detects a feature request for which `openspec/changes/{feature}/tasks.md` already exists
- **THEN** the spec-gate ceremony passes through immediately
- **THEN** the Coordinator routes directly from the existing `tasks.md`
