## Context

The current registry model is a flat list of file paths per asset. This works for simple assets (a skill is one markdown file), but hooks, MCP servers, and plugins are already multi-file and growing more complex. The `dev-workflow` plugin today lists five separate file paths in `registry.json`. There is no way to express that an asset needs user-supplied configuration, or that a setup step must be run after installation.

The engine today does: fetch files → transform → write → update lockfile. Nothing before or after this pipeline is extensible. Adding setup flows means adding a new lifecycle layer.

The design must preserve backward compatibility for simple assets (skills, agents, instructions, commands) while giving complex assets (hooks, mcp-servers, plugins) the richer structure they need.

## Goals / Non-Goals

**Goals:**
- Introduce `manifest.json` as the structural contract for folder-based assets
- Split registry.json entries into `file` (simple) and `folder` (complex) — no more enumerating files for complex assets in the registry
- Declarative userConfig: collect named values at install time, store securely, substitute into non-sensitive files
- Imperative scripts: detect and notify, never execute — user runs manually
- Hard-guard sensitive values from ever being written into asset files
- Auto-gitignore configuredFiles (substituted output + script output)
- Preserve configuredFiles across updates (re-prompt rather than overwrite)
- Update `add-asset` authoring skill with safety guardrails

**Non-Goals:**
- Engine execution of imperative scripts (notify only)
- Pre-install or pre-uninstall lifecycle hooks
- Python or shell scripts (Node.js only for cross-platform consistency)
- Per-channel userConfig (out of scope; not a concept in ai-stash)
- OAuth or token-refresh flows

## Decisions

### Decision 1: `file` vs `folder` split — not a versioned format change

**Choice:** Extend `RegistryAsset` with optional `file?: string` and `folder?: string` fields. Keep `files[]` working for any entry that still has it. Migrate complex assets to `folder` in registry.json.

**Why:** A hard version bump to registry format would break existing installs and cached registry copies. Adding optional fields is non-breaking. The engine checks: `folder` present → manifest path; `file` present → single file; `files[]` present → legacy flat list.

**Alternative considered:** Bump `version` in registry.json from 1 to 2 and require all entries to use the new shape. Rejected: breaks all existing caches, no backward compat.

---

### Decision 2: `manifest.json` is fetched on demand, not mirrored into registry.json

**Choice:** When the engine encounters a `folder` entry, it fetches `{folder}/manifest.json` as the first step of the install. The manifest declares files, userConfig, scripts, and configuredFiles.

**Why:** Keeps registry.json thin and browse-friendly. Asset authors can add files and update scripts without touching the central registry index. Aligns with how `package.json` relates to a package registry.

**Alternative considered:** Inline all manifest fields into registry.json entries. Rejected: makes registry.json large and tightly coupled to per-asset implementation details; every script change requires a registry re-publish.

---

### Decision 3: Sensitive values go to keychain; non-sensitive go to `~/.config/ai-stash/settings.json`

**Choice:** Add `keytar` as a regular dependency for OS keychain access (Mac Keychain, Windows Credential Store, Linux libsecret — platform-agnostic). Wrap the `require` in a try/catch at call time; if keytar fails to load (e.g. native bindings not built), fall back automatically to `~/.config/ai-stash/credentials.json` with `0600` permissions and emit a one-time info message indicating which store is in use. Non-sensitive values stored in `~/.config/ai-stash/settings.json`.

**Why:** Matches the Claude plugin userConfig model. Sensitive values must never appear in any project-tracked file or in the lockfile. keytar is platform-agnostic so no platform branching is needed; the try/catch fallback handles edge-case environments without disrupting the majority of users.

**Alternative considered:** Store everything encrypted in the lockfile. Rejected: lockfile is checked into git in project scope, creating a path for credential leakage regardless of encryption.

---

### Decision 4: Sensitive values are NEVER substituted into files

**Choice:** The engine substitutes `${user_config.<key>}` only for non-sensitive values. Sensitive values are exported as `CLAUDE_STASH_CONFIG_<KEY>` env vars — available to the target runtime (MCP server, hook process) and to the user's imperative script, but never written into any file by the engine.

**Why:** File-content substitution is irreversible — once a key is written to a file and that file is committed, the key is leaked. The only safe guarantee is that sensitive values never touch the filesystem via the engine. This mirrors how Claude Code plugins handle the same constraint.

**Alternative considered:** Substitute sensitive values but auto-gitignore the output file. Rejected: gitignore is advisory — git add -f or a misconfigured repo can still commit it. Defense in depth requires not writing the value at all.

---

### Decision 5: Imperative scripts are Node.js only

**Choice:** `manifest.json` `scripts.postInstall` and `scripts.postUninstall` must be `.js` or `.mjs` files. The authoring skill warns if any other extension is used.

**Why:** ai-stash itself requires Node.js, so every user is guaranteed to have a compatible runtime. Shell scripts fail on Windows; Python is not universally available.

**Alternative considered:** Allow platform-specific script maps (`{ unix: "setup.sh", windows: "setup.ps1" }`). Rejected: doubles authoring burden, two scripts to maintain, divergence risk. Mandate Node.js is cleaner.

---

### Decision 6: configuredFiles tracked by presence, not by lockfile

**Choice:** Files declared in `manifest.json` `configuredFiles[]` are auto-added to `.gitignore` by the engine at install time but are NOT added to the lockfile's `files[]` list. On update, the engine skips configuredFiles (does not overwrite). On sync (fresh clone), missing configuredFiles trigger a re-prompt for userConfig.

**Why:** configuredFiles are user-specific. Tracking them in the lockfile (a shared file) would cause conflicts when teammates sync. Not tracking them means the engine never overwrites a user's configured state on update — and can detect "needs reconfiguration" by their absence.

**Alternative considered:** Track configuredFiles in a separate per-user sidecar lockfile. Rejected: adds a new file format and complicates the sync logic. Absence detection against the manifest is sufficient.

---

### Decision 7: `.setup-complete` sentinel for script completion status

**Choice:** The `ai-stash status` command scans installed folder-based assets for `manifest.json` entries with `scripts.postInstall`. If the installed folder lacks a `.setup-complete` file, the asset is shown as "setup pending". The `setup.js` script is responsible for creating `.setup-complete` as its final step. `.setup-complete` is listed in `configuredFiles[]` automatically by the add-asset skill so it is gitignored.

**Why:** The engine cannot know whether the user has run the script. An honor-system sentinel created by the script is the minimal solution that doesn't require engine tracking.

**Alternative considered:** Track script run status in the lockfile. Rejected: the lockfile is shared; script completion is per-user-environment, not per-project.

### Decision 8: Update re-prompt UX — assume configuration is broken, flag as reconfiguration needed

**Choice:** When an asset is updated, the engine assumes the new version may have changed how config values are used (different substitution targets, new files, changed script behaviour). The update completes (files are written, lockfile updated) but the asset is flagged as `reconfigurationNeeded: true` in the lockfile entry. The TUI and `ai-stash status` surface it as "reconfiguration needed". To opt out, the asset author sets `"configStable": true` in `manifest.json`, signalling that userConfig values are safe to carry over across any version — the engine then skips the flag and proceeds silently.

**Why:** An update that silently reuses stale config is harder to debug than one that visibly asks the user to re-verify. The opt-in `configStable` flag puts the burden on the author who knows their asset is safe, not on the user who doesn't know what changed.

**Alternative considered:** Prompt inline for all userConfig on every update. Rejected: disruptive for stable assets like a GitHub MCP server whose token never changes; `configStable` lets well-behaved authors avoid this.

---

### Decision 9: Authoring validation — warn, never hard-block

**Choice:** The `add-asset` skill warns authors about policy violations (non-Node scripts, sensitive values not flagged, setup output not in configuredFiles) with clear explanations and suggested fixes. It does not refuse to scaffold the asset.

**Why:** Authors may have unusual setups — e.g. a hook targeting only Linux where bash is guaranteed. Hard-blocking tooling creates workarounds (authors bypass the skill entirely). Warnings educate without forcing; the consequences of ignoring them are well-documented.

---

## Risks / Trade-offs

- **keytar native bindings** → keytar requires node-gyp compilation; in environments without build tools it may fail to install. Mitigation: add as a regular dependency but wrap the `require` in a try/catch at call time — fall back to credentials file automatically with a one-time info message. No platform branching needed since keytar supports Mac, Windows, and Linux.
- **Manifest fetch adds a round-trip per complex asset install** → Mitigation: cache manifest alongside installed files (it is already fetched as part of the folder). Re-installs read from disk.
- **Node.js script mandate limits what setup scripts can do on some platforms** → Mitigation: Node.js `child_process` can invoke platform tools where needed; this is the author's responsibility.
- **`.setup-complete` sentinel can be faked or accidentally committed** → Mitigation: `.setup-complete` is always in `configuredFiles[]` and thus gitignored. Faking it is a user choice, not a system failure.
- **configuredFiles gitignore injection may conflict with existing .gitignore rules** → Mitigation: check before appending; do not add duplicate entries.
- **Updating an asset does not re-collect userConfig** → If a new version adds a userConfig key that the user hasn't provided, substitution will produce a literal `${user_config.new_key}` in the file. Mitigation: on update, detect missing userConfig keys and prompt for them before executing the install.

## Migration Plan

1. Extend `RegistryAsset` type — additive, no breakage.
2. Update registry fetcher to handle `folder` entries (manifest fetch + file list resolution).
3. Update install engine to collect userConfig before writing files.
4. Update update/remove engine for configuredFiles preservation and postUninstall notice.
5. Add keychain/credentials storage module.
6. Add TUI userConfig prompt component; add headless readline equivalent.
7. Migrate `registry/registry.json` entries for hooks, mcp-servers, plugins to `folder` field.
8. Add `manifest.json` to each affected asset folder in the registry.
9. Update `add-asset` skill with authoring safety checks.
10. No lockfile migration required — existing lockfile entries are unaffected (they have no manifest).

**Rollback:** The `files[]` path remains supported throughout. Reverting the registry.json migration restores prior behaviour; no lockfile changes are needed.

## Open Questions

None — all questions resolved.
