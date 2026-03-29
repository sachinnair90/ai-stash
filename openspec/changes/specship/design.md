## Context

ai-stash is a TUI-based plugin registry for managing AI assistant assets (skills, agents, hooks, instructions, plugins) for Claude Code and GitHub Copilot. It already supports folder-based plugins with `manifest.json`, lifecycle scripts (`postInstall`/`postUninstall`), script risk disclaimers (`SCRIPT_RISKS.md`), and `.setup-complete` tracking.

Squad is an AI team framework that lives in `.github/agents/squad.agent.md`. Its Coordinator routes work to cast agents using a native extension system: `.squad/skills/` (injected into agent spawns via routing), `.squad/ceremonies.md` (auto-triggered before/after work batches), and `.squad/routing.md` (work assignment rules). Squad's `squad.agent.md` is authoritative — it must never be modified by third-party plugins.

OpenSpec is a spec-driven development framework. Its CLI scaffolds change directories under `openspec/changes/<name>/` with `proposal.md`, `design.md`, `specs/`, and `tasks.md`. The explore skill (`openspec-explore`) is the diagnostic mode that sharpens vague ideas before proposal.

The integration gap: Squad agents implement features without accessing OpenSpec specs, and OpenSpec artifacts never flow back into Squad's memory. specship installs the connective tissue using only Squad's native extension points.

## Goals / Non-Goals

**Goals:**
- Install a `Speccer` agent (permanent Squad roster member) who owns the OpenSpec artifact lifecycle
- Install a `spec-gate` ceremony that fires before feature implementation, running explore-or-propose and gating on human approval
- Install Squad skills that inject OpenSpec context into implementors and teach Scribe to absorb spec decisions on archive
- Provide a version-pinned post-install script that ensures known-good Squad + OpenSpec versions and idempotently applies routing/ceremony patches
- Ship as a standard ai-stash folder-based plugin with no changes to `src/`

**Non-Goals:**
- Modifying `squad.agent.md` — all Squad integration goes through `.squad/` extension files only
- Replacing or wrapping the OpenSpec CLI — OpenSpec runs as-is; specship only installs files that reference its outputs
- Auto-executing the post-install script — it is always run manually per ai-stash's security model
- Supporting Squad versions other than the pinned `0.9.x` or OpenSpec versions other than `1.2.x`

## Decisions

**D1: Plugin form factor — folder-based plugin with manifest.json**
specship uses ai-stash's existing folder-based plugin type (same as `dev-workflow`). The manifest declares `files`, `scripts.postInstall`, and `scriptRisks`. This gives us free `.setup-complete` tracking, script hash change detection on upgrade, and the existing risk disclaimer flow.
_Alternative considered_: Separate skill + agent assets. Rejected — a plugin bundles related assets under one install/uninstall unit, which is critical for the Squad extension files that must be installed together.

**D2: Speccer as permanent roster member, not ceremony-only specialist**
The Speccer is added to `.squad/agents/speccer/charter.md` and referenced in the routing and ceremony patches as a named, persistent agent. This lets the Speccer accumulate `history.md` across sessions — after several features it knows the project's architecture and naming patterns, making its specs progressively sharper.
_Alternative considered_: Ad-hoc spawn during ceremony only. Rejected — a cold-spawned Speccer has no codebase memory, producing generic specs.

**D3: Ceremony patches and routing patches as separate appendable files, not direct writes**
The post-install script appends `ceremonies-patch.md` content into `.squad/ceremonies.md` and `routing-patch.md` content into `.squad/routing.md`, with idempotency checks (grep for `spec-gate` / `Speccer` before appending). Direct overwrite would destroy user customisations.
_Alternative considered_: Shipping complete replacement files. Rejected — users have customised ceremonies and routing; overwriting is destructive.

**D4: Explore-or-propose decision lives in the Speccer's charter, not the ceremony definition**
The ceremony invokes the Speccer (sync). The Speccer's charter encodes the clarity-assessment logic: assess specificity → if vague, invoke OpenSpec explore mode → loop until sharp → produce proposal. The ceremony only defines the trigger condition and the human gate on approval.
_Alternative considered_: Encoding the decision tree in the ceremony YAML. Rejected — ceremonies are configuration, not agent behaviour. The Speccer is the agent; the decision is its domain.

**D5: Two Squad skills — one for implementors, one for Scribe**
`openspec` skill: injected into all agents working on feature tasks. Teaches them to check `openspec/changes/{feature}/specs/` and validate work against acceptance criteria.
`openspec-scribe` skill: injected into Scribe's post-archive invocation. Teaches Scribe to read `verification-report.md` and `proposal.md`, extract decisions, append to `decisions.md`, update affected agent histories.
_Alternative considered_: A single skill for all agents. Rejected — Scribe's behaviour (absorbing spec artifacts into memory) is distinct enough from implementors' behaviour (reading specs as constraints) that mixing them adds noise to both.

**D6: Post-install script in Node.js**
ai-stash's `buildScriptNotice` emits `node {scriptPath}` — scripts must be Node.js. The setup script uses `child_process.execSync` for CLI invocations (`squad --version`, `openspec init`, etc.) and writes `.setup-complete` on success.

**D7: Version pinning at `squad@0.9.x` and `openspec@1.2.x`**
The manifest documents these as the tested surface. The post-install script checks the installed versions and installs the pinned versions if missing or mismatched. When specship is upgraded, the script hash change triggers a re-review prompt in ai-stash, and the new script may update the pinned versions.

## Risks / Trade-offs

**Squad version drift** → If a user upgrades Squad independently, ceremony and routing patch formats may be stale. Mitigation: the post-install script checks versions and warns if mismatch detected. Future specship versions will update pinned versions after testing.

**Idempotency edge cases** → The grep check (`spec-gate` in ceremonies.md) could false-positive if a user has a ceremony with that string for another reason. Mitigation: use a more specific sentinel comment (`# specship:spec-gate`) as the idempotency marker.

**Speccer history.md growth** → On large projects, Speccer's history grows unboundedly. Mitigation: Scribe already handles history summarisation at 12KB threshold — no special handling needed.

**No postUninstall for Squad patches** → The post-install script appends to Squad files; the postUninstall script would need to remove those appended sections. Mitigation: provide a postUninstall script that greps-and-removes the sentinelled sections; document manual steps in SCRIPT_RISKS.md.

**scripts run as `node`** → The post-install script cannot use shell-only constructs. All Squad/OpenSpec CLI invocations go through `child_process.execSync`.

## Migration Plan

Fresh install:
1. User runs `ai-stash add plugin specship`
2. ai-stash shows risk disclaimer + script notice
3. User reviews `scripts/setup.js` and `SCRIPT_RISKS.md`
4. User runs `node .claude-plugin/specship/scripts/setup.js` (or the path shown by ai-stash)
5. Script installs/verifies Squad + OpenSpec, inits directories, appends patches, writes `.setup-complete`
6. User adds Speccer to their team: Squad coordinator creates the cast name and history seed

Upgrade path:
- ai-stash detects script hash change, re-shows disclaimer
- User re-runs setup script; idempotency checks prevent double-patching

Rollback:
- `ai-stash remove specship` removes installed files
- `postUninstall` script removes sentinel-marked sections from ceremonies.md and routing.md
- `.squad/agents/speccer/` folder moved to `.squad/agents/_alumni/speccer/` (preserving history)

## Open Questions

- Should the Speccer be exempt from universe casting (like Scribe/Ralph) or get a cast name? Current lean: cast name — the Speccer is a domain expert with personality, not a silent utility.
- Should `specship` bundle a starter `ceremonies.md` and `routing.md` for repos that don't have Squad initialised yet, or always rely on the post-install script to init Squad first?
