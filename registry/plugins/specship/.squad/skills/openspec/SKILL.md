---
name: "openspec"
description: "Spec-driven implementation: read OpenSpec acceptance criteria before implementing, validate work against scenarios, produce verification evidence"
domain: "spec-driven-development"
confidence: "high"
source: "specship plugin"
---

## Context

Apply this skill whenever you are implementing tasks for a feature that has an OpenSpec change directory. Before writing any code, check whether `openspec/changes/` contains a folder for the current feature. If it does, the specs are your contract — not the chat history.

## Patterns

**1. Locate the spec artifacts**

At the start of any feature task, resolve the feature name from the task description or the Coordinator's spawn prompt. Then check:

```
openspec/changes/{feature-name}/
  proposal.md          — why and what (background context)
  design.md            — technical approach and decisions
  specs/               — acceptance criteria (source of truth)
  tasks.md             — your checklist
```

If `openspec/changes/{feature-name}/` does not exist, proceed normally and note the absence.

**2. Read specs before implementing**

Read every `.md` file under `openspec/changes/{feature-name}/specs/`. Each file covers one capability. Each `#### Scenario:` block is a testable acceptance criterion in WHEN/THEN format. These are your definition of done — not a suggestion.

**3. Validate work against scenarios**

After completing each task, verify your implementation satisfies the scenario(s) that task maps to. Work through the WHEN condition and confirm the THEN outcome holds. If a scenario cannot be satisfied as written, note it explicitly — do not silently skip.

**4. Produce verification-report.md**

When all tasks in `tasks.md` are checked off, write:

```
openspec/changes/{feature-name}/verification-report.md
```

Format: one entry per task, each citing the spec scenario(s) it satisfies and the evidence (file changed, test result, behaviour confirmed).

```markdown
## Task N.N: {task description}
- **Spec:** specs/{capability}/spec.md → Scenario: {scenario name}
- **Evidence:** {what was done, file modified, behaviour confirmed}
- **Status:** ✅ Pass / ⚠️ Partial / ❌ Fail
```

**5. Note mismatches in the report, not in chat**

If your implementation differs from a spec scenario (scope change, technical constraint, design decision), record it in the verification report under a `## Deviations` section with a reason. Do not silently deviate.

## Anti-Patterns

- **Implementing without reading specs** — the spec is the contract, not the user's last message
- **Marking a task done without checking its scenario** — done means the scenario passes, not just that code was written
- **Omitting verification-report.md** — this is what enables the human gate and Scribe memory absorption
- **Rewriting specs to match your implementation** — if the spec is wrong, flag it; don't quietly fix it to match what you built
