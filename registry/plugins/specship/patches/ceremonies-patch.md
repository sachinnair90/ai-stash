# specship:spec-gate
# This block was appended by the specship plugin post-install script.
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
2. Spawn Speccer (sync) with the user's feature description. Speccer assesses clarity internally: clear idea → writes artifacts directly; vague idea → enters OpenSpec explore mode, loops until developer types `/propose`.
3. Speccer writes `proposal.md`, `design.md`, `specs/`, and `tasks.md` under `openspec/changes/{feature-name}/`.
4. Present a proposal summary to the developer (Why in 1–2 sentences, What changes as a bullet list, task count from `tasks.md`). Ask: *"Approve this spec and start implementation?"* — Yes, proceed / Request changes / Cancel.
5. On approval: pass the feature name and `tasks.md` path to the Coordinator. Add to all implementation spawn prompts: `INPUT ARTIFACTS: openspec/changes/{feature-name}/specs/` and `Relevant skill: .squad/skills/openspec/SKILL.md — read before starting`.

---

# /specship:spec-gate
