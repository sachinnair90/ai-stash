## ADDED Requirements

### Requirement: openspec-scribe skill is installed into .squad/skills/openspec-scribe/
The openspec-scribe Squad skill SHALL be installed at `.squad/skills/openspec-scribe/SKILL.md` and injected into Scribe's spawn prompt after a feature is archived.

#### Scenario: Scribe receives the skill on post-archive spawn
- **WHEN** the Coordinator spawns Scribe after a feature archive event
- **THEN** Scribe's spawn prompt includes a reference to `.squad/skills/openspec-scribe/SKILL.md`

### Requirement: Scribe absorbs spec decisions into decisions.md on archive
The skill SHALL instruct Scribe to read `verification-report.md` and `proposal.md` from the archived feature and extract key decisions for appending to `.squad/decisions.md`.

#### Scenario: Spec decisions flow into shared team memory
- **WHEN** Scribe runs its post-archive absorption
- **THEN** Scribe reads `openspec/changes/{feature}/proposal.md` and `verification-report.md`
- **THEN** key architectural decisions from the proposal are appended to `.squad/decisions.md`

### Requirement: Scribe propagates spec learnings to affected agent histories
The skill SHALL instruct Scribe to identify which agents worked on the feature and append relevant patterns from the specs to their `history.md`.

#### Scenario: Agent histories reflect spec patterns
- **WHEN** Scribe processes a completed feature
- **THEN** Scribe appends spec-derived patterns (naming conventions, architectural decisions) to `history.md` for each agent that contributed to the feature

### Requirement: Scribe archives the OpenSpec change folder after absorption
The skill SHALL instruct Scribe to move `openspec/changes/{feature}/` to `openspec/changes/archive/{YYYY-MM-DD}-{feature}/` after memory absorption is complete.

#### Scenario: Change folder is archived
- **WHEN** Scribe completes memory absorption
- **THEN** `openspec/changes/{feature}/` is moved to `openspec/changes/archive/{date}-{feature}/`
- **THEN** the original `openspec/changes/{feature}/` path no longer exists
