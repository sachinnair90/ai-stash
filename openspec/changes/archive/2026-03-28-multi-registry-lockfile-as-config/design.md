## Context

ai-stash currently supports a single registry configured via `~/.config/ai-stash/config.json`. The lockfile (`ai-stash.lock.json`) records a single `registry: string` URL at the top level and keys installed assets by bare name (e.g., `"git-commit"`). This means:

- Teams cannot share registry configuration — each developer must manually configure the same registry
- Assets from multiple sources cannot coexist in one project
- Two same-named assets of different types (skill vs command) collide in the lockfile
- The config file lives outside the project, making it invisible to version control

## Goals / Non-Goals

**Goals:**
- Support multiple named registries per project, all equal in priority
- Move registry configuration into the lockfile so it is committed with the project
- Eliminate the config file (`~/.config/ai-stash/config.json`) entirely
- Change lockfile key to `registry:type:name` to encode provenance and type-scope asset identity
- Detect and resolve install-time conflicts when two registries have the same-type, same-name asset
- Surface orphaned assets (registry name in key not found in current `registries[]`)
- Add registry management via TUI Registries view and CLI subcommands

**Non-Goals:**
- Global/personal registries that persist across all projects
- Modifying the registry.json wire format (registries remain as-is)
- Automatic de-duplication or merging of same-named assets across registries
- Priority ordering between registries

## Decisions

### 1. Registries live in the lockfile, not a config file

**Decision:** Remove `src/config/` entirely. Store `registries: RegistryConfig[]` as a top-level field in `ai-stash.lock.json`.

**Rationale:** The lockfile is already project-local and committed to version control. Putting registries there means a `git clone` + `ai-stash sync` is fully reproducible with no out-of-band configuration. A separate config file creates a two-file synchronisation problem and is invisible to teammates.

**Alternative considered:** Keep `config.json` but add a project-local overlay (layered config). Rejected because it adds two-layer merge complexity and still requires each developer to manage a personal config. Since personal/global registries were explicitly out of scope (assets from personal registries break team reproducibility), there is no justification for a global config layer.

### 2. Lockfile key format: `registry:type:name`

**Decision:** Change the `installed` record key from `"name"` to `"registry:type:name"` (e.g., `"community:skill:git-commit"`). The `registry` segment is the human-readable name from `registries[]`, `type` is the asset type, and `name` is the original asset name in the registry (never the suffixed disk name).

**Rationale:**
- `registry` in the key: encodes provenance without a separate field; makes orphaned assets detectable by name comparison; human-readable in the raw JSON
- `type` in the key: enables a `skill` and `command` both named `git-commit` to coexist — they install to different paths and serve different purposes
- Original `name` (not suffixed): the key is a stable identity anchor; the disk name (which may be suffixed) is encoded in `files[]`

**Alternative considered:** `type:name` (no registry segment). Rejected because it loses provenance — update and sync cannot determine which registry URL to fetch from without an additional field lookup, and orphaned asset detection requires a registry name comparison anyway.

**Alternative considered:** URL as the registry segment. Rejected because URLs are long, brittle to endpoint changes, and unreadable in the raw lockfile. The registry name is more stable in practice and `registryUrl` in `InstalledAsset` provides the stable URL for operations.

### 3. Suffix-on-conflict: first-installed keeps the clean name

**Decision:** When a user installs an asset where `lockfile.installed["reg:type:name"]` already exists from a *different* registry, the incoming asset's disk name becomes `name-registryname` (e.g., `git-commit-acme`). The lockfile key always uses the original name. The suffix is applied only at install time and only when a conflict exists.

**Rationale:** Keeps the single-registry experience unchanged (no suffix ever if only one registry). Makes the conflict explicit without requiring a priority system. The user is notified post-install.

**Alternative considered:** Always suffix with registry name (e.g., `git-commit-community`). Rejected because it degrades the common single-registry case — users would invoke `/git-commit-community` instead of `/git-commit`.

**Alternative considered:** Priority-ordered merge (first registry wins clean name silently). Rejected because it silently masks the conflict and breaks updates when registry order changes.

### 4. `registryUrl` stored in `InstalledAsset`

**Decision:** Add `registryUrl: string` to `InstalledAsset`. This is the fetch URL at install time, independent of the registry name used in the key.

**Rationale:** The lockfile key uses the human name (e.g., `"acme"`), which can change if the user renames a registry. The URL is what update and sync actually need to fetch from. Decoupling the identity label (key) from the operational URL (field) means a rename only affects the key — operations continue working via `registryUrl`.

**Alternative considered:** Derive the URL from config at runtime by matching registry name. Rejected because it breaks if the registry is removed or renamed — the same scenario we want to surface as "orphaned" rather than silently fail.

### 5. Per-registry cache keyed by URL hash

**Decision:** Replace the single `registry.json` cache file with per-registry cache files named by the hash of the registry URL (e.g., `~/.cache/ai-stash/registry-<sha256prefix>.json`).

**Rationale:** Multiple registries have independent freshness states. A single cache file cannot represent stale/fresh independently per registry, and refreshing one registry would incorrectly invalidate others.

## Risks / Trade-offs

**Breaking lockfile format** → Mitigated by automatic v1→v2 migration on first read. The migration is lossless: the old `registry` URL maps to a named registry derived from the current config (or the URL itself as fallback), and all keys are rekeyed using `InstalledAsset.type`.

**Registry name change orphans assets** → Surfaced as a visible warning in the Installed view ("registry 'acme' not configured"). Remove still works (files are on disk). User resolves by re-adding the registry with the original name or reinstalling. Accepted trade-off: name stability is the user's responsibility, and the warning makes the problem immediately visible.

**Suffix persists after original is uninstalled** → If the clean-named asset is removed, the suffixed variant remains with its suffix. The user must reinstall to get the clean name. Accepted: this is predictable behaviour and the alternative (automatic rename) would require lock-step operations that add complexity without clear benefit.

**Long registry names produce verbose suffixes** → `git-commit-acme-internal-registry` is long. No short-name aliasing is provided (adds abstraction). Accepted: registry names are user-chosen and typically short.

## Migration Plan

Migration from v1 to v2 runs automatically on first `readLockfile()` call when `lockfile.version === 1`:

1. **Derive registry name**: match `lockfile.registry` URL against current `registries[]` in the lockfile (which won't exist yet in v1 — fall back to current config if present, else use the URL string itself as the name)
2. **Build `registries[]`**: `[{ name: derivedName, url: lockfile.registry }]`
3. **Rekey all entries**: for each `installed[name]` entry, new key = `"${derivedName}:${entry.type}:${name}"`
4. **Backfill `registryUrl`**: set `InstalledAsset.registryUrl = lockfile.registry` for all entries
5. **Write v2 lockfile** to disk immediately after migration

Rollback: v1 lockfiles are not modified until migration writes v2. A backup copy at `ai-stash.lock.json.v1.bak` is written before migration to allow manual recovery.
