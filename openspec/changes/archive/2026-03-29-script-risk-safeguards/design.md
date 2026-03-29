# Design: Script Risk Safeguards

## Context

ai-stash currently ships `scripts.postInstall` / `scripts.postUninstall` as a notice-only mechanism: the engine prints a path and the developer runs the script manually. The engine never auto-executes. However, no ceremony distinguishes a "has setup script" plugin from a simple skill at install time. The developer can browse, select, and install without ever seeing that the asset carries arbitrary-code potential. Post-install, there are no signals when a script changes between versions. On removal, there is no warning when `postInstall` exists but `postUninstall` does not.

This change adds five safety layers without changing the core model (scripts remain manual-run, developer is always in control):

1. Visible risk labelling at browse time
2. Mandatory explicit acceptance gate at install time
3. Script-content hash stored in lockfile, checked on update
4. Removal warning when cleanup is incomplete
5. Author tooling (add-asset skill) to produce risk documentation

## Goals / Non-Goals

**Goals:**

- Make script presence impossible to miss at every relevant interaction point (browse, install, update, remove)
- Give developers a CLI-provided generic risk list plus author-supplied context (what the script does, what it installs, how to undo) in the same screen where they accept risk
- Detect when a script changes between versions and require re-review
- Warn on removal when side effects cannot be cleaned up
- Push asset authors to document their scripts via skill enforcement
- Document the trust model in the registry README so the boundary is explicit

**Non-Goals:**

- Sandboxing or analysing script contents (ai-stash has no means to do this reliably)
- Ref-counting shared tool installations across plugins (out of scope)
- Enforcing rollback on partial script failure (scripts are opaque)
- Auto-executing scripts ever, for any reason
- Cross-platform script portability checks (author's responsibility)

## Decisions

### D1: `SCRIPT_RISKS.md` is NOT in `manifest.files[]`; it is fetched on-demand via `scriptRisks` field

**Decision:** Add `scriptRisks?: string` to `AssetManifest` pointing to a file path (e.g. `"SCRIPT_RISKS.md"`). The engine fetches this file only during the disclaimer phase, not as part of the regular file install. `SCRIPT_RISKS.md` is NOT listed in `files[]` and is NOT installed on disk.

**Rationale:** The risk document is informational and exists for the developer's benefit at acceptance time. Shipping it onto disk adds files the developer may not want, would need .gitignore handling, and adds complexity to the uninstall path. Fetching on-demand keeps the install surface clean while still surfacing the content where it matters.

**Alternative considered:** Include in `files[]` so it lands in the installed folder for later reference. Rejected — the disclaimers screen is the right moment; after that the developer has already accepted and the file has diminishing value on disk.

### D2: Risk acceptance is tracked per-asset in the lockfile, keyed to script hash

**Decision:** Store `riskAccepted: true` and `riskAcceptedAt: <ISO>` in `InstalledAsset`. When the script hash changes on update, reset both fields and re-trigger the disclaimer.

**Rationale:** Without tracking acceptance, sync and re-install flows would re-show the disclaimer unnecessarily. Tying acceptance to the script hash means the user only re-reviews when the script actually changes — not on every version bump.

### D3: `hasScripts` is a static flag on `RegistryAsset` set at registry-build time

**Decision:** Add `hasScripts?: boolean` to `RegistryAsset` (in `registry.json`). When true, the browse view shows the badge without fetching the manifest.

**Rationale:** Fetching manifests for all registry assets at browse time would be expensive (N network requests). A pre-computed boolean flag on the registry entry costs nothing and is sufficient for badging. It is the registry author's (or build tool's) responsibility to keep it accurate.

**Note on data source difference:** The TUI browse badge is driven by `asset.hasScripts` (registry data, available before install). The headless `list` badge is driven by `installedEntry.scriptHashes` (lockfile data, available only post-install). This asymmetry is intentional — browse must work without manifest fetches, while list can rely on the lockfile.

### D4: Headless acceptance is `--accept-script-risks` per-asset install command, not a global flag

**Decision:** The headless `ai-stash add <name>` command prompts interactively (y/N) when a script is present. A `--accept-script-risks` flag bypasses the prompt for CI use. The flag applies to the single command invocation, not globally.

**Rationale:** A global "always accept" flag could be set in rc files or CI env, silently bypassing the safety check for future installs. Per-invocation is the right scope — explicit and auditable.

### D5: Generic CLI risk disclaimer is shown first, before author documentation

**Decision:** The CLI ships a built-in generic risk disclaimer that is always shown when an asset has scripts, regardless of whether the author has provided `SCRIPT_RISKS.md`. The generic disclaimer appears first, followed by the author's documentation (if available) as a separate section labelled "Author's Risk Documentation". The generic text lists categories of risk that apply to any scripted asset: filesystem changes, network access, process execution, shell modification, and persistence mechanisms.

**Rationale:** Author-supplied documentation can be absent, incomplete, or misleading. A CLI-native baseline ensures the developer always sees a consistent minimum risk surface before reviewing author-specific details. Ordering generic first means the developer reads it even if they skim past the author section.

### D6: `scriptHashes` stores sha256 of already-fetched script content

**Decision:** At install time, hash the raw text content of `postInstall` and `postUninstall` scripts using Node's `crypto.createHash('sha256').update(content).digest('hex')`. Content is read from the already-fetched `rawFiles` map (keyed by the script filename as declared in the manifest) — no additional network fetch is made. Store hashes in `InstalledAsset.scriptHashes`.

**Rationale:** Content hash catches real changes regardless of filename renames. sha256 is collision-resistant and already available in Node without additional dependencies. Re-using already-fetched content avoids a redundant network request.

### D7: `executeInstall` accepts risk acceptance state via options

**Decision:** Add `riskAccepted?: boolean` and `riskAcceptedAt?: string` to the `executeInstall` options object. When provided, these values are written onto the lockfile entry. When absent, no `riskAccepted` field is written (preserving existing absence semantics for non-scripted assets).

**Rationale:** `executeInstall` currently builds a fresh `InstalledAsset` object, losing any acceptance state the caller collected from the disclaimer flow. Adding these as explicit options keeps the function's interface explicit and testable, rather than threading state through the plan object.

### D8: `syncFromLockfile` preserves existing `riskAccepted` state

**Decision:** When `syncFromLockfile` reinstalls an asset, it reads the existing lockfile entry's `riskAccepted` and `riskAcceptedAt` values and passes them into `executeInstall` via the options added in D7. No disclaimer is shown during sync.

**Rationale:** Sync restores files to match the lockfile — it is not a new install decision. The developer already reviewed and accepted the risk when the lockfile entry was first created. Re-prompting on every sync would make sync unusable in CI and would be annoying in development. If the installed version's script hasn't changed (which sync doesn't change — it installs the lockfile version), there is nothing new to review.

### D9: `update --all` halts at the first scripted change and requires explicit re-run

**Decision:** When `ai-stash update --all` encounters an asset with a changed script, it prints the disclaimer and halts the batch. The developer must re-run `ai-stash update <name>` (or `ai-stash update <name> --accept-script-risks`) for that asset individually. Remaining assets in the batch are not updated.

**Rationale:** An interactive prompt mid-batch loop is awkward and can be missed if output is scrolled. Halting at the first change is predictable and forces a deliberate review. The developer can then re-run `--all` after addressing the scripted asset.

**Alternative considered:** Skip scripted-change assets and update the rest. Rejected — silent skipping could leave a developer believing `--all` updated everything when it silently deferred one.

### D10: Disclaimer gate lives in the caller, not inside `executeInstall` or `installAssetFull`

**Decision:** `handleAddCommand` (and the TUI install flow) are refactored to call `planInstall` → disclaimer gate → `executeInstall` directly, rather than delegating to `installAssetFull`. The `installAsset` TUI-compat wrapper in `install.ts` is updated to accept `riskAccepted` state as an argument and pass it through; callers in `InstallView.tsx` are responsible for gating on the disclaimer before calling it.

**Rationale:** Embedding the gate inside `installAssetFull` or `executeInstall` would require those functions to do I/O (printing, reading stdin), which violates their current contract as pure orchestrators. Keeping the gate in callers preserves testability and avoids mixing UI concerns into the engine layer.

### D11: `.setup-complete` deletion on script change happens after file writes complete

**Decision:** In the update flow, the `.setup-complete` marker is deleted after `executeInstall` has written all updated files, not before. The incoming manifest (carried on the plan) is used to determine whether a script is present — not the on-disk manifest.

**Rationale:** Deleting `.setup-complete` before file writes could leave the asset in a partially-written state if the write fails. `checkSetupPending()` reads the on-disk manifest to check for `scripts.postInstall`; if it runs between deletion and the manifest write completing, it may see a stale manifest. Using the plan's manifest avoids this race.

## Risks / Trade-offs

**`hasScripts` in registry.json can be stale if author updates manifest without re-publishing registry** → Mitigation: add-asset skill sets this field and reminds authors to re-run registry generation on manifest changes. Stale `false` shows no badge; stale `true` shows badge unnecessarily — the false positive is safer than the false negative.

**`SCRIPT_RISKS.md` fetch adds a network request during install disclaimer phase** → Mitigation: graceful fallback if the file is unreachable — show the generic risk list only and note "author risk documentation unavailable." This should be uncommon since the manifest itself fetched successfully.

**`--accept-script-risks` in CI scripts normalises bypassing the check** → Mitigation: this is an informed trade-off. CI systems need non-interactive installs. Document it clearly. The flag is explicit — harder to accidentally set than an env var or global config.

**Script content might be large; hashing entire content adds time** → In practice, postInstall scripts are small (tens of KB at most). sha256 of a few KB is sub-millisecond.

**add-asset skill enforcement is advisory, not compile-time enforced** → Registries must independently verify `SCRIPT_RISKS.md` presence and `postUninstall` existence when reviewing assets. The skill is a floor, not a guarantee.

**`update --all` halting on first scripted change may surprise developers** → Mitigation: the halt message names the blocking asset and gives the exact command to run to unblock. After that single asset is handled, `--all` completes normally.

## Migration Plan

No breaking changes. All new lockfile fields (`scriptHashes`, `riskAccepted`, `riskAcceptedAt`) are optional. Old lockfile entries simply lack these fields — the engine treats absence as "not yet reviewed" and will show the disclaimer on the next install/update of that asset. No lockfile version bump required.

## Open Questions

None — all decisions resolved.
