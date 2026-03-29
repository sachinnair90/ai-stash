## 1. Registry Entry

- [x] 1.1 Create `registry/plugins/specship/` directory structure
- [x] 1.2 Write `registry/plugins/specship/manifest.json` declaring all plugin files, `scripts.postInstall`, `scripts.postUninstall`, and `scriptRisks`
- [x] 1.3 Add specship entry to `registry/registry.json` under `plugins` with name, version, description, tags (`["workflow", "spec-driven", "squad", "openspec", "planning"]`), targets (`["claude-code"]`), and folder path
- [x] 1.4 Write `registry/plugins/specship/SCRIPT_RISKS.md` documenting what the post-install and post-uninstall scripts do, side effects, and manual cleanup steps

## 2. Speccer Agent Charter

- [x] 2.1 Write `registry/plugins/specship/.squad/agents/speccer/charter.md` with identity, role (📐 Spec Lead), expertise, style (opinionated about clarity, pushes back on vague requirements), what it owns, how it works (clarity assessment → explore-or-propose decision logic), and boundaries (never writes code)
- [x] 2.2 Seed `registry/plugins/specship/.squad/agents/speccer/history.md` with the project-context template structure (owner/project/stack placeholders) so the Coordinator can fill it on team init

## 3. Squad Skills

- [x] 3.1 Write `registry/plugins/specship/.squad/skills/openspec/SKILL.md` — domain, confidence, context (when to apply), patterns (how to locate specs/, validate against scenarios, produce verification-report.md), and anti-patterns
- [x] 3.2 Write `registry/plugins/specship/.squad/skills/openspec-scribe/SKILL.md` — domain, confidence, context (post-archive trigger), patterns (read proposal.md + verification-report.md, extract decisions, append to decisions.md, propagate to agent histories, move change folder to archive/), and anti-patterns

## 4. Ceremony and Routing Patches

- [x] 4.1 Write `registry/plugins/specship/patches/ceremonies-patch.md` — the spec-gate ceremony definition block with sentinel comment `# specship:spec-gate`, trigger condition, Speccer as facilitator (sync), human gate on proposal approval, ceremony output structure (feature name, tasks.md path, specs/ path)
- [x] 4.2 Write `registry/plugins/specship/patches/routing-patch.md` — the Speccer routing entry block with sentinel comment `# specship:speccer`, routing rules for "new feature" and "spec" request types

## 5. Post-Install Script

- [x] 5.1 Write `registry/plugins/specship/scripts/setup.js` — Squad version check + conditional install at pinned version (`0.9.x`), OpenSpec version check + conditional install at pinned version (`1.2.x`), `.squad/` init if absent, `openspec/` init if absent, idempotent ceremony patch application (sentinel grep before append), idempotent routing patch application, write `.setup-complete` on success, exit non-zero with message on any failure
- [x] 5.2 Write `registry/plugins/specship/scripts/cleanup.js` — grep-and-remove sentinel-marked sections from `.squad/ceremonies.md` and `.squad/routing.md`, move `.squad/agents/speccer/` to `.squad/agents/_alumni/speccer/`, remove `.setup-complete`

## 6. Verification

- [x] 6.1 Confirm all files listed in `manifest.json` exist in `registry/plugins/specship/`
- [x] 6.2 Confirm `registry/registry.json` parses cleanly after the new entry is added
- [x] 6.3 Manually trace through `scripts/setup.js` logic for fresh-install and re-run (idempotency) scenarios
- [x] 6.4 Manually trace through `scripts/cleanup.js` logic for clean uninstall
