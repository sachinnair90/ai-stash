## ADDED Requirements

### Requirement: openspec skill is installed into .squad/skills/openspec/
The openspec Squad skill SHALL be installed at `.squad/skills/openspec/SKILL.md` and SHALL be discoverable by Squad's skill-aware routing mechanism.

#### Scenario: Skill is injected into feature implementation spawns
- **WHEN** the Coordinator routes a feature implementation task
- **THEN** the Coordinator detects the openspec skill in `.squad/skills/`
- **THEN** the spawn prompt for the implementation agent includes a reference to `.squad/skills/openspec/SKILL.md`

### Requirement: openspec skill teaches agents to read specs as acceptance criteria
The skill SHALL instruct implementors to locate `openspec/changes/{feature}/specs/` and treat each scenario as a testable acceptance criterion.

#### Scenario: Agent validates work against specs
- **WHEN** an implementor completes a task
- **THEN** the agent checks its output against the scenarios in `openspec/changes/{feature}/specs/`
- **THEN** the agent notes in its response which scenarios pass and which do not

### Requirement: openspec skill instructs agents to write verification evidence
The skill SHALL instruct implementors to produce `verification-report.md` evidence after completing all tasks, mapping each task to the spec scenario it satisfies.

#### Scenario: verification-report.md is produced after implementation
- **WHEN** all tasks in `tasks.md` are checked off
- **THEN** `openspec/changes/{feature}/verification-report.md` is written with task-by-task evidence
- **THEN** each evidence entry references the spec scenario it satisfies
