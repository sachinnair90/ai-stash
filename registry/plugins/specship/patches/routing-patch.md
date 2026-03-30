# specship:speccer
# This block was inserted by the specship plugin post-install script.
# To remove: run the specship postUninstall script, or delete everything
# between the specship:speccer and /specship:speccer sentinels.

## ⛔ Spec Gate — Check This First

**If the request is a new feature** ("build X", "add X", "implement X", "create X", "I want X to do Y"):

1. Check whether `openspec/changes/` contains a `tasks.md` for this feature.
   - **Yes** → proceed to the routing table below.
   - **No** → STOP. Route to **Speccer**. Do not spawn any developer until Speccer has produced a spec and the user has approved it.

This check runs before anything else. Eager execution does not apply here — a feature without a spec does not get built.

> Exceptions: bug fixes, refactors, chores, docs-only changes, dependency updates.

---

# /specship:speccer
