## Why

OpenSpec and Squad are powerful independently but have no native integration — developers context-switch between spec creation and team orchestration, and specs live outside Squad's memory, meaning agents implement without acceptance criteria and decisions are never traced back to the specs that motivated them. specship closes this gap by making spec-driven development a first-class Squad ceremony.

## What Changes

- New ai-stash plugin `specship` added to the registry under `registry/plugins/specship/`
- A `Speccer` agent charter is installed into `.squad/agents/speccer/` — a permanent roster member who owns the OpenSpec artifact lifecycle
- A `spec-gate` ceremony definition is provided as a patch to `.squad/ceremonies.md` — fires before any feature implementation task
- Two Squad skills are installed: `openspec` (injected into all implementors) and `openspec-scribe` (injected into Scribe for post-archive memory absorption)
- A routing patch is provided for `.squad/routing.md` to direct "new feature" work through the Speccer first
- A Node.js post-install script (`scripts/setup.js`) verifies and installs pinned versions of Squad and OpenSpec CLIs, inits them if absent, and applies patches idempotently
- A `SCRIPT_RISKS.md` documents what the post-install script does and its side effects
- `openspec/changes/` directory is scaffolded in the target repo if absent

## Capabilities

### New Capabilities

- `specship-plugin`: The installable ai-stash plugin — manifest, files, post-install script, and registry entry
- `spec-gate-ceremony`: The Squad ceremony that intercepts feature work, runs the Speccer's explore-or-propose flow, gates on human approval, and hands `tasks.md` to the Coordinator
- `speccer-agent`: The Speccer agent charter — assesses idea clarity, chooses explore vs propose, produces the full OpenSpec artifact tree, never implements
- `squad-openspec-skill`: The Squad skill injected into implementors — teaches agents to read `openspec/changes/{feature}/specs/` as acceptance criteria
- `squad-openspec-scribe-skill`: The Squad skill injected into Scribe — absorbs spec decisions into `decisions.md` and agent histories on archive
- `post-install-setup`: The version-pinned post-install script — ensures Squad and OpenSpec are at tested versions, inits, patches

### Modified Capabilities

## Impact

- New directory: `registry/plugins/specship/` in the ai-stash registry
- New registry entry in `registry/registry.json` under `plugins`
- No changes to `src/` — uses existing plugin install machinery (`manifest.json`, `scripts.postInstall`, `SCRIPT_RISKS.md`)
- No changes to `squad.agent.md` — all integration through Squad's native extension points (skills, ceremonies, routing)
- Depends on: ai-stash plugin engine (folder-based plugin with manifest), Squad CLI `0.9.x`, OpenSpec CLI `1.2.x`
