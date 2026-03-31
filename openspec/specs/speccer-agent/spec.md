## ADDED Requirements

### Requirement: Speccer has a permanent charter installed in .squad/agents/speccer/
The Speccer agent charter SHALL be installed at `.squad/agents/speccer/charter.md` and referenced in the routing patch as a named, persistent team member.

#### Scenario: Speccer is routable by the Coordinator
- **WHEN** the Coordinator reads `.squad/routing.md`
- **THEN** the Speccer is listed with routing rules for "new feature" and "spec" request types
- **THEN** the Coordinator can spawn the Speccer by name

### Requirement: Speccer assesses idea clarity before producing artifacts
Before writing any OpenSpec artifacts, the Speccer SHALL assess whether the developer's idea is specific enough to proceed to proposal without guessing.

#### Scenario: Clear idea proceeds directly to proposal
- **WHEN** the Speccer receives a feature description with a clear actor, trigger, and outcome
- **THEN** the Speccer proceeds directly to producing `proposal.md`, `design.md`, `specs/`, and `tasks.md`
- **THEN** the Speccer does NOT invoke explore mode

#### Scenario: Vague idea triggers explore mode
- **WHEN** the Speccer receives a feature description that is ambiguous, outcome-unclear, or would require assumptions to spec
- **THEN** the Speccer surfaces the specific clarity gap (not a generic "tell me more")
- **THEN** the Speccer invokes OpenSpec explore mode
- **THEN** explore mode runs until the developer signals readiness with `/propose`

### Requirement: Speccer produces the full OpenSpec artifact tree on propose
When producing a proposal (either directly or after explore), the Speccer SHALL write all four OpenSpec artifacts for the feature.

#### Scenario: Full artifact tree is written
- **WHEN** the Speccer enters proposal mode
- **THEN** `openspec/changes/{feature}/proposal.md` is created with why, what changes, capabilities, and impact
- **THEN** `openspec/changes/{feature}/design.md` is created with technical approach and decisions
- **THEN** `openspec/changes/{feature}/specs/` contains at least one spec file with Given/When/Then scenarios
- **THEN** `openspec/changes/{feature}/tasks.md` contains a numbered checklist with each task mapped to at least one spec

### Requirement: Speccer never writes implementation code
The Speccer SHALL be bounded to spec artifact production only and SHALL NOT write application code, tests, or configuration files.

#### Scenario: Speccer rejects implementation requests
- **WHEN** the Coordinator routes an implementation task to the Speccer
- **THEN** the Speccer declines and redirects to the appropriate implementor agent

### Requirement: Speccer accumulates history.md across sessions
The Speccer SHALL append to `.squad/agents/speccer/history.md` after each session, recording project architecture patterns, naming conventions, and constraint decisions that improve future spec quality.

#### Scenario: Speccer references prior history when writing specs
- **WHEN** the Speccer is spawned for a new feature
- **THEN** the Speccer reads `.squad/agents/speccer/history.md` before assessing the idea
- **THEN** spec artifacts reflect codebase conventions recorded in prior sessions
