## Context

The lockfile (`ai-stash.lock.json`) tracks installed assets with their scope, targets, and file paths. When a teammate clones a repo containing a lockfile, none of the asset files exist locally. Currently the only way to install them is to manually browse and install each asset through the TUI.

The install engine already supports installing a single asset with a known scope and targets via `installAsset()`. The lockfile already records all the information needed to replay those installs. The gap is purely at the orchestration layer — nothing reads the lockfile and drives `installAsset()` in batch.

## Goals / Non-Goals

**Goals:**
- Detect assets in the lockfile that are missing locally (files don't exist on disk)
- Install all missing assets in one operation using the recorded scope, targets, and registry URL from the lockfile
- Surface the unsynced count as a passive signal in the Browse footer
- Provide a dedicated Sync view accessible via `s` from Browse

**Non-Goals:**
- Version reconciliation (that's the Updates view's job)
- Modifying the lockfile format
- Offline sync (requires live registry to fetch asset files)
- Conflict resolution UI (treat missing files as clean installs — no conflicts expected)

## Decisions

### How to detect "missing locally"

**Decision:** Check whether the first file in `installedAsset.files` exists on disk. If it's absent, the asset is considered unsynced.

**Alternatives considered:**
- Check all files — more thorough but slower and rarely needed; if the first file is present the install is assumed intact
- Re-hash file contents — too slow and complex for a sync check

### How to drive installation

**Decision:** Add a new engine function `syncFromLockfile(lockfile, projectRoot, registryBaseUrl, token?)` that iterates unsynced entries and calls `planInstall` + `executeInstall` directly, bypassing the scope/targets prompt entirely (values come from the lockfile entry).

**Alternatives considered:**
- Reuse `installAsset()` — it re-reads the lockfile from disk on each call and rebuilds state; simpler to use a leaner path that operates on the already-loaded lockfile
- Drive the existing InstallView — it's designed for interactive scope/target selection; repurposing it would require conditional rendering and add complexity

### Cross-referencing registry assets

**Decision:** `SyncView` receives the full `assets: RegistryAsset[]` array (already loaded in App) and matches each lockfile entry by name to find the `RegistryAsset` needed for `planInstall`.

If a lockfile entry has no match in the registry (asset was removed or registry changed), skip it and show a warning — don't fail the whole sync.

### Footer badge

**Decision:** Compute unsynced count in `App.tsx` (same place lockfile and assets are loaded) and pass it as a prop to `Footer`. Keep Footer a pure display component.

## Risks / Trade-offs

- **Registry mismatch** → Lockfile may reference assets no longer in the registry. Mitigation: skip with a visible warning per asset, continue syncing the rest.
- **Version drift** → Lockfile records the version that was installed; the registry may have a newer version. Sync installs the registry's current version (same as a fresh install). If version pinning matters, use the Updates view first. This is acceptable and consistent with how `npm install` behaves on a fresh clone.
- **Global-scope assets** → Files go to `~/.claude/` not the project root. Sync handles these identically to project-scope assets — the scope is read from the lockfile entry.

## Open Questions

- Should sync show a confirmation step before writing files, or just proceed? Current plan: show a summary list with `y` to confirm, matching the style of the Updates view.
