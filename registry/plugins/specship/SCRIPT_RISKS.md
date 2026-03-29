# specship — Script Risk Documentation

## scripts/setup.js (postInstall)

### What it does

1. **Checks Squad CLI version** — runs `squad --version` and compares against the pinned version (`0.9.x`). If missing or mismatched, installs the pinned version globally via `npm install -g`.
2. **Checks OpenSpec CLI version** — runs `openspec --version` and compares against the pinned version (`1.2.x`). If missing or mismatched, installs the pinned version globally via `npm install -g`.
3. **Inits `.squad/`** — if `.squad/` does not exist in the current directory, runs `squad init` to scaffold the Squad directory structure.
4. **Inits `openspec/`** — if `openspec/` does not exist, runs `openspec init` to scaffold the OpenSpec directory structure.
5. **Applies ceremony patch** — appends the spec-gate ceremony definition to `.squad/ceremonies.md`. Checks for the sentinel `# specship:spec-gate` first; skips if already present.
6. **Applies routing patch** — appends the Speccer routing entry to `.squad/routing.md`. Checks for the sentinel `# specship:speccer` first; skips if already present.
7. **Writes `.setup-complete`** — creates this file in the plugin directory on success so ai-stash can track setup status.

### Side effects

- May install or upgrade `squad` and `openspec` globally via npm (requires npm in PATH)
- Modifies `.squad/ceremonies.md` and `.squad/routing.md` by appending content
- Creates `.squad/` and `openspec/` directories if absent
- Does NOT modify `squad.agent.md` or any existing agent charters

### If it fails

- The script exits non-zero and prints which step failed
- `.setup-complete` is NOT written — ai-stash will continue showing a setup-pending warning
- Partially applied patches are safe: re-running the script is idempotent (sentinel checks prevent double-appending)

---

## scripts/cleanup.js (postUninstall)

### What it does

1. **Removes ceremony patch** — finds and removes the sentinel-delimited `spec-gate` block from `.squad/ceremonies.md`.
2. **Removes routing patch** — finds and removes the sentinel-delimited `speccer` routing block from `.squad/routing.md`.
3. **Archives Speccer agent** — moves `.squad/agents/speccer/` to `.squad/agents/_alumni/speccer/` (preserves history, does not delete).
4. **Removes `.setup-complete`** — cleans up the setup tracking file.

### Side effects

- Modifies `.squad/ceremonies.md` and `.squad/routing.md` by removing sentinel-delimited blocks
- Moves (does not delete) `.squad/agents/speccer/` to `_alumni/` — Speccer history is preserved
- Does NOT uninstall Squad or OpenSpec CLIs (they may be used by other tools)
- Does NOT remove `openspec/` directory (may contain user's spec artifacts)

### Manual cleanup (if script cannot run)

Remove the blocks between these sentinel comments manually:

In `.squad/ceremonies.md`: remove everything between `# specship:spec-gate` and `# /specship:spec-gate`

In `.squad/routing.md`: remove everything between `# specship:speccer` and `# /specship:speccer`
