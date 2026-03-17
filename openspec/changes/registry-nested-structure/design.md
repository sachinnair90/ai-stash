## Context

`registry.json` currently has a flat `assets` array. Every asset carries an explicit `type` field (`skill`, `agent`, `instruction`, `prompt`, `hook`). The `files` array holds bare filenames (e.g. `["main.md"]`), and when the install engine fetches those files it relies on some implicit URL convention (the path is passed directly to `new URL(filePath, baseUrl)`). This implicit convention is undocumented and fragile — bare filenames resolve relative to the registry.json URL, not to an asset-specific folder.

Three capabilities are touched:
- `src/registry/` — the types and parsing
- `src/adapters/claude-code/` — one `getInstallPaths` code path that does a bare-filename comparison
- `src/adapters/copilot/` — same, in `transformFiles`

## Goals / Non-Goals

**Goals:**
- Registry JSON organises assets by type under top-level buckets (`skills`, `agents`, `instructions`, `prompts`, `hooks`)
- Each asset's `files` entries are registry-root-relative paths (`skills/foo/main.md`), making fetch URLs unambiguous
- The existing engine and UI layers require no changes — normalisation happens at parse time
- Adapters are fixed to be resilient to full paths in `asset.files` (not just bare filenames)

**Non-Goals:**
- Changing the lockfile format or installed-path conventions
- Adding per-type metadata fields to the registry schema
- A migration tool for existing installed assets
- Publishing or updating any remote registry

## Decisions

### Decision 1: Nested buckets vs. per-type registry files

**Chosen:** Single `registry.json` with top-level type keys (`skills: [...]`, `agents: [...]`, etc.)

**Alternatives considered:**
- Separate `registry-skills.json`, `registry-agents.json` etc. — would require multiple HTTP round-trips and more complex cache invalidation.
- A `type`-indexed map (`{ "skill": [...] }`) — equivalent, but less readable than the explicit plural names.

**Rationale:** Single-file fetch preserves the current caching behaviour unchanged. Explicit plural keys (`skills`, `agents`) are self-documenting and directly map to the folder names on disk.

---

### Decision 2: Files as registry-root-relative paths

**Chosen:** `files: ["skills/foo/main.md"]` rather than bare `files: ["main.md"]`

**Alternatives considered:**
- Adding a separate `path: "skills/foo"` field alongside bare `files` — two sources of truth; adapter code would need to combine them.
- Keeping bare filenames and deriving the prefix from `{type}s/{name}/` — implicit coupling between RegistryAsset fields and URL construction rules.

**Rationale:** Embedding the full path in `files` makes each entry self-contained and the URL `new URL(f, baseUrl)` correct without extra logic. `path.basename(f)` gives the bare filename wherever adapters need it.

---

### Decision 3: Normalise nested → flat at parse time in `fetchRegistry`

**Chosen:** `fetchRegistry` returns the existing `RegistryIndex` shape with `assets: RegistryAsset[]`, injecting `type` from the bucket key during parsing.

**Alternatives considered:**
- Propagating the nested shape through the entire codebase — too much churn; engine, UI, lockfile and tests all reference `RegistryIndex.assets`.
- Normalising in `getRegistry` (client layer) rather than `fetchRegistry` — marginally cleaner separation but the raw type from the network is still nested, so it's cleaner to convert at the boundary.

**Rationale:** Single-point-of-conversion keeps the diff small and the rest of the codebase unchanged.

---

### Decision 4: Adapter robustness via `path.basename`

Only `src/adapters/claude-code/index.ts` needs a code change: the hook `getInstallPaths` case filters `files` entries by comparing to the bare string `'hook-config.json'` and then uses the full entry as a path segment. Both must use `path.basename(f)`.

`copilot/index.ts` uses `filePath.endsWith('hook-config.json')` in `transformFiles`, which already handles full paths correctly. No change needed there.

## Risks / Trade-offs

**Risk: Test fixtures out of sync** — any test that constructs a `RegistryIndex` with the old flat `assets` shape will fail.
→ Mitigation: Update all `sampleRegistry` fixtures in `src/__tests__/` as part of this change.

**Risk: Future adapters assume bare filenames in `asset.files`** — the `path.basename` convention is not enforced by the type system.
→ Mitigation: Document the convention in `RegistryAsset.files` JSDoc.

**Risk: `new URL(f, baseUrl)` edge cases** — if `baseUrl` doesn't end with `/`, URL resolution may drop the last path segment.
→ Mitigation: `fetchAssetFile` already uses `new URL(filePath, baseUrl)`, which is correct when `baseUrl` ends in `/`. Ensure the config registry URL always has a trailing slash, or normalise in `fetchAssetFile`.

## Migration Plan

1. Update `RegistryIndex` and `RegistryAsset` types
2. Update `fetchRegistry` to parse nested format and flatten to `assets[]`
3. Fix `claude-code-adapter` hook path handling
4. Update all test fixtures
5. No deployed registry exists yet — no data migration needed
