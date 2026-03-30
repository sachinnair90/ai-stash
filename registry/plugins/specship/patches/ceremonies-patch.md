# specship:spec-gate
# This block was inserted by the specship plugin post-install script.
# To remove: run the specship postUninstall script, or delete everything
# between the specship:spec-gate and /specship:spec-gate sentinels.

## Spec Gate

| Field | Value |
| ----- | ----- |
| **Trigger** | auto |
| **When** | before |
| **Condition** | Any request introducing a new feature, capability, or user-facing behaviour. Signals: "build X", "add X", "implement X", "create X", "new feature", "I want X to do Y". NOT triggered by: bug fixes, refactors, chores, dependency updates, docs-only changes, or features with an existing approved spec in `openspec/changes/`. |
| **Facilitator** | Speccer |
| **Participants** | Speccer |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Flow:**

1. Check `openspec/changes/` — if a `tasks.md` already exists for this feature, the spec is approved. Skip the ceremony and proceed to implementation.
2. Spawn Speccer (sync) with only the user's raw words and project context. Do NOT pre-fill design decisions, schema choices, endpoint names, component names, or technical answers — those are Speccer's domain. Speccer's first step is a clarity assessment; if the idea is vague, Speccer enters explore mode and asks the user focused questions before writing anything.
3. **⛔ HARD STOP after Speccer finishes.** Do NOT proceed to implementation. Do NOT spawn any developer agent.
4. Present the spec summary to the user (Why in 1–2 sentences, What changes as a bullet list, task count from `tasks.md`). Ask: *"Approve this spec and start implementation? (Yes / Request changes / Cancel)"*
   - **Approved** → pass feature name and `tasks.md` path to the Coordinator. Add to all implementation spawn prompts: `INPUT ARTIFACTS: openspec/changes/{feature-name}/specs/` and `Relevant skill: .squad/skills/openspec/SKILL.md — read before starting`.
   - **Changes requested** → loop back to Speccer.
   - **Cancelled** → stop entirely.

> Speccer finishing ≠ spec approved. Approval is a separate explicit action from the user.

---

# /specship:spec-gate
