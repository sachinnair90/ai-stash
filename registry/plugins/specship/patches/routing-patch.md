# specship:speccer
# This block was appended by the specship plugin post-install script.
# To remove: run the specship postUninstall script, or delete everything
# between the specship:speccer and /specship:speccer sentinels.

## Spec Gate — Feature Implementation Rule

> **Before routing any feature implementation request** ("build X", "add X", "implement X",
> "create X", "new feature") to a developer agent, you MUST check `ceremonies.md` for the
> spec-gate ceremony.

Do NOT spawn a developer until either:

- a `tasks.md` already exists in `openspec/changes/` for this feature (spec approved), OR
- the spec-gate ceremony has completed and the developer has approved the spec.

> This rule takes precedence over general work routing. Routing to a developer before a spec
> is approved is not permitted when the spec-gate ceremony is enabled.

## Speccer Routing

> This table covers direct Speccer routing — cases where the developer is explicitly asking
> about specs. Feature implementation requests go through the spec-gate rule above, not here.

| Work Type | Route To | Examples |
| --------- | -------- | -------- |
| Direct spec request | Speccer | "spec X", "write a spec for X", "spec out X" |
| Spec status check | Speccer | "is X specced?", "do we have a spec for X?" |
| Explicit explore | Speccer | "explore X" before any spec exists |

# /specship:speccer
