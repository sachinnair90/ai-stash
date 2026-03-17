## Why

The current `registry.json` uses a flat `assets` array where every asset carries a `type` field to distinguish skills, agents, instructions, prompts, and hooks. This makes the registry harder to browse, validate per-type, and extend with type-specific metadata — and means consumers must filter by type rather than going directly to the relevant bucket. Adopting a nested structure (one top-level key per asset type) aligns the registry shape with how assets are actually organised on disk.

## What Changes

- `registry.json` format changes from a flat `assets: [...]` array to typed top-level buckets: `skills`, `agents`, `instructions`, `prompts`, `hooks`
- Each asset item no longer needs an explicit `type` field (it is implied by the bucket it lives in)
- Asset `files` entries become registry-root-relative paths (`skills/foo/main.md` instead of bare `main.md`), making URL construction unambiguous
- `RegistryIndex` and `RegistryAsset` TypeScript types are updated to reflect the new shape
- `fetchRegistry` normalises the nested JSON into a flat in-memory asset list (adding `type` back from the bucket key) so the rest of the engine requires minimal changes
- The Claude Code and Copilot adapters are updated wherever they compare or manipulate `files` entries by bare filename (e.g. the `hook-config.json` filter in `getInstallPaths`) to use `path.basename(f)` for robustness against the now-full paths
- Sample/test registry fixtures are updated to match the new format

## Capabilities

### New Capabilities

_(none — this is a structural refactor, not new functionality)_

### Modified Capabilities

- `registry-client`: `RegistryIndex` type changes to nested buckets; `fetchRegistry` normalises to flat asset list with `type` populated from bucket key; asset `files` are now registry-root-relative paths
- `claude-code-adapter`: `getInstallPaths` and `transformFiles` file comparisons updated to use `path.basename(f)` to handle full-path `files` entries correctly
- `copilot-adapter`: Same adapter-level fixes as `claude-code-adapter`

## Impact

- **`src/registry/types.ts`** — `RegistryIndex` interface: replace `assets: RegistryAsset[]` with per-type arrays; `RegistryAsset` interface: `type` becomes optional (populated at parse time)
- **`src/registry/fetcher.ts`** — `fetchRegistry` must flatten the nested buckets into `assets[]`, injecting `type` from the bucket key
- **`src/adapters/claude-code/index.ts`** — fix bare-filename comparisons in `getInstallPaths` (hook filter) and `extractAssetName` patterns
- **`src/adapters/copilot/index.ts`** — same fixes
- **`src/__tests__/registry-client.test.ts`** — update `sampleRegistry` fixture to nested format
- **`src/__tests__/claude-code-adapter.test.ts`** and **`copilot-adapter.test.ts`** — update any `files` arrays in fixture assets to use full paths
- **No breaking changes** to the install engine, lockfile, or UI layers — they all work with the normalised flat asset list
