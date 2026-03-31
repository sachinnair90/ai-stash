---
name: "openspec-scribe"
description: "Post-archive memory absorption: read spec artifacts after feature completion, extract decisions, update shared memory, archive the change folder"
domain: "spec-driven-development"
confidence: "high"
source: "specship plugin"
---

## Context

Apply this skill when you (Scribe) are spawned after a feature's human sign-off gate passes. The Coordinator will include a note in your spawn prompt indicating a specship archive event. Your job: absorb the spec artifacts into the team's long-term memory, then move the change folder to the archive.

## Patterns

**1. Locate the feature's change directory**

The Coordinator's spawn prompt will include the feature name. Resolve:

```
openspec/changes/{feature-name}/
  proposal.md
  verification-report.md
  specs/
  tasks.md             (all tasks checked off)
```

If `verification-report.md` does not exist, log a warning in the session log and skip the absorption step — do not fail silently.

**2. Extract decisions from proposal.md**

Read `proposal.md`. Extract:
- Key scoping decisions (what was explicitly out of scope and why)
- Architectural choices mentioned in the Impact section
- Any constraints that would affect future features

Append each to `.squad/decisions.md` using the standard format:

```markdown
### {date}: {feature-name} — {decision summary}
**By:** {Speccer cast name}
**What:** {the decision}
**Why:** {the rationale from proposal.md}
```

**3. Extract patterns from verification-report.md**

Read `verification-report.md`. Identify:
- Implementation patterns that proved correct (from ✅ Pass entries)
- Deviations that reveal constraints (from the Deviations section)
- Any file paths, module names, or architectural touchpoints surfaced during implementation

**4. Propagate learnings to affected agent histories**

For each agent that contributed to the feature (from the orchestration log or spawn manifest):
- Append a `📌 Team update` to their `history.md`:

```
📌 Team update ({date}): {feature-name} shipped. Key patterns: {1-2 sentences}. See decisions.md for scoping decisions.
```

**5. Archive the change folder**

Move `openspec/changes/{feature-name}/` to:

```
openspec/changes/archive/{YYYY-MM-DD}-{feature-name}/
```

Use today's date. Create `openspec/changes/archive/` if it does not exist. The original path must not exist after this step.

**6. Commit .squad/ and openspec/ changes**

Stage and commit:
```
git add .squad/ openspec/
git commit -m "docs(specship): absorb {feature-name} spec decisions into team memory"
```

## Anti-Patterns

- **Absorbing before verification-report.md exists** — only run absorption after sign-off; the report is evidence the feature is done
- **Deleting instead of archiving** — always move to `archive/`, never delete
- **Writing vague history entries** — "feature shipped" is noise; write what the next agent needs to know
- **Skipping the archive step** — if `openspec/changes/{feature-name}/` still exists after Scribe runs, the workflow is incomplete
