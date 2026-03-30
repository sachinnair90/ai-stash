# specship:speccer
# This block was inserted by the specship plugin post-install script.
# To remove: run the specship postUninstall script, or delete everything
# between the specship:speccer and /specship:speccer sentinels.

## ⛔ Spec Gate — Check This First

**If the request is a new feature** ("build X", "add X", "implement X", "create X", "I want X to do Y"):

1. Check whether `openspec/changes/` contains a `tasks.md` for this feature.
   - **Yes → tasks.md exists** → proceed to the routing table below.
   - **No → tasks.md missing** → follow steps 2–4 below. Do NOT spawn any developer agent until step 4 is complete.

2. Spawn **Speccer** (sync) with only the user's raw words and project context. Do NOT pre-fill design decisions, schema choices, endpoint names, component names, or technical answers — those are Speccer's domain. Speccer's Step 1 is a clarity assessment; if the idea is vague, Speccer enters explore mode and asks the user focused questions before writing anything.
3. **⛔ HARD STOP after Speccer finishes.** Do NOT proceed. Do NOT spawn any developer agent.
4. Present the spec summary to the user and ask: *"Approve this spec and start implementation? (Yes / Request changes / Cancel)"*
   - **Approved** → proceed to the routing table below.
   - **Changes requested** → loop back to Speccer.
   - **Cancelled** → stop entirely.

> Speccer finishing ≠ spec approved. Approval is a separate explicit action from the user.

This check runs before anything else. Eager execution does not apply here — a feature without an approved spec does not get built.

> Exceptions: bug fixes, refactors, chores, docs-only changes, dependency updates.

---

## Speccer — Direct Routing

| Work Type | Route To | Examples |
| --------- | -------- | -------- |
| Direct spec request | Speccer | "spec X", "write a spec for X" |
| Spec status check | Speccer | "is X specced?", "do we have a spec for X?" |
| Explicit explore | Speccer | "explore X" before any spec exists |

# /specship:speccer
