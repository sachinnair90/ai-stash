# specship:speccer
# This block was appended by the specship plugin post-install script.
# To remove: run the specship postUninstall script, or delete everything
# between the specship:speccer and /specship:speccer sentinels.

> **Note:** Implicit feature requests ("build X", "add X", "implement X") are intercepted
> by the spec-gate ceremony (see `.squad/ceremonies.md`). This table covers direct Speccer
> routing only — cases where the developer is explicitly asking about specs.

| Signal | Route to | Notes |
|--------|----------|-------|
| "spec X", "write a spec for X", "spec out X" | {Speccer cast name} | Direct spec request — bypass ceremony, spawn Speccer immediately |
| "is X specced?", "do we have a spec for X?" | {Speccer cast name} | Spec status check — Speccer checks openspec/changes/ and reports |
| "explore X" (before any spec exists) | {Speccer cast name} | Explicit explore request — Speccer enters OpenSpec explore mode |

# /specship:speccer
