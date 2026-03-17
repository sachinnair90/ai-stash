## 1. Update Registry Types

- [x] 1.1 In `src/registry/types.ts`, replace the `assets: RegistryAsset[]` field on `RegistryIndex` with typed buckets: `skills`, `agents`, `instructions`, `prompts`, `hooks` (each `RegistryAsset[]`, all optional/defaulting to `[]`)
- [x] 1.2 Add a `NestedRegistryIndex` interface (or rename the raw network type) to represent the over-the-wire nested format, keeping `RegistryIndex` as the normalised flat form used internally (with `assets: RegistryAsset[]`)

## 2. Update Registry Fetcher

- [x] 2.1 In `src/registry/fetcher.ts`, update `fetchRegistry` to accept the nested wire format and flatten it: iterate over each bucket key (`skills`, `agents`, etc.), set `type` on each asset from the bucket key (singularising: `skills` → `skill`), and collect into `assets[]`
- [x] 2.2 Ensure the returned `RegistryIndex` shape (with `assets[]`) is unchanged so all downstream consumers require no changes

## 3. Fix Claude Code Adapter Hook Path Handling

- [x] 3.1 In `src/adapters/claude-code/index.ts`, update the `hook` case in `getInstallPaths` to use `path.basename(f) !== 'hook-config.json'` for the filter (instead of `f !== 'hook-config.json'`)
- [x] 3.2 In the same hook case, update the `map` call to use `path.basename(f)` as the filename component: `path.join(base, 'hooks', asset.name, path.basename(f))`

## 4. Update Test Fixtures

- [x] 4.1 In `src/__tests__/registry-client.test.ts`, add a `nestedRegistry` fixture in the nested wire format (with `skills`, `agents`, etc. buckets) and update the `fetchRegistry` mock response and assertion to use it; keep `sampleRegistry` as the normalised flat form for cache tests
- [x] 4.2 In `src/__tests__/claude-code-adapter.test.ts`, update the hook test fixture to use full registry-root-relative paths in `files` (e.g. `['hooks/my-hook/hook-config.json', 'hooks/my-hook/check.sh']`) and update path expectations to use the basename
- [x] 4.3 In `src/__tests__/copilot-adapter.test.ts`, update any hook or skill test fixtures that use bare filenames in `files` to use full registry-root-relative paths and verify assertions still pass

## 5. Verify and Run Tests

- [x] 5.1 Run `pnpm run typecheck` and fix any type errors
- [x] 5.2 Run `pnpm run test` and fix any failing tests
