## 1. Type System

- [x] 1.1 In `src/adapters/types.ts`, update `AssetType` union: remove `'prompt'`, add `'command'`, `'plugin'`, `'mcp-server'`

## 2. Registry Client

- [x] 2.1 In `src/registry/types.ts`, update `NestedRegistryIndex`: replace `prompts?` with `commands?`, add `plugins?` and `mcpServers?`
- [x] 2.2 In `src/registry/fetcher.ts`, update `BUCKET_TO_TYPE`: replace `prompts: 'prompt'` with `commands: 'command'`, add `plugins: 'plugin'` and `mcpServers: 'mcp-server'`

## 3. Lockfile Migration

- [x] 3.1 In the lockfile reader, add read-time coercion: if a locked asset has `type === 'prompt'`, normalise to `'command'`

## 4. Claude Code Adapter

- [x] 4.1 In `src/adapters/claude-code/index.ts` `getInstallPaths`: rename `case 'prompt'` → `case 'command'`
- [x] 4.2 Add `case 'plugin'` in `getInstallPaths`: strip `plugins/{name}/` prefix and map files to `{base}/plugins/{name}/{rel}`
- [x] 4.3 Add `case 'mcp-server'` in `getInstallPaths`: return `[path.join(base, '.mcp.json')]` for project scope, `[path.join(os.homedir(), '.claude', 'mcp.json')]` for global scope
- [x] 4.4 In `transformFiles`: rename `case 'prompt'` → `case 'command'`; add `case 'plugin'` (passthrough); add `case 'mcp-server'` producing `{ "mcpServers": { ... } }` from asset's `mcp.json`
- [x] 4.5 In `mergeIntoExisting`: add `case 'mcp-server'` merging `mcpServers` objects by key into existing `.mcp.json`
- [x] 4.6 In `removeAsset`: rename `case 'prompt'` → `case 'command'`; add `case 'plugin'` deleting `{base}/plugins/{name}/` recursively; add `case 'mcp-server'` removing the server key(s) from `.mcp.json`

## 5. Copilot Adapter

- [x] 5.1 In `src/adapters/copilot/index.ts` `getInstallPaths`: rename `case 'prompt'` → `case 'command'`
- [x] 5.2 Add `case 'plugin'` in `getInstallPaths`: strip `plugins/{name}/` prefix and map files to `{base}/plugins/{name}/{rel}`
- [x] 5.3 Add `case 'mcp-server'` in `getInstallPaths`: return `['.vscode/mcp.json']`
- [x] 5.4 In `transformFiles`: rename `case 'prompt'` → `case 'command'`; add `case 'plugin'` (passthrough); add `case 'mcp-server'` transforming asset `mcpServers` → `servers` key for `.vscode/mcp.json` format
- [x] 5.5 In `mergeIntoExisting`: add `case 'mcp-server'` merging `servers` objects by key into existing `.vscode/mcp.json`
- [x] 5.6 In `removeAsset`: rename `case 'prompt'` → `case 'command'`; add `case 'plugin'` deleting `{base}/plugins/{name}/` recursively; add `case 'mcp-server'` removing the server key(s) from `.vscode/mcp.json`

## 6. TUI

- [x] 6.1 Update type filter list: replace `prompt`/`prompts` with `command`/`commands`, add `plugin`/`plugins` and `mcp-server`/`mcp-servers`
- [x] 6.2 Update color badge map: `command`=purple, `plugin`=cyan, `mcp-server`=orange (drop `prompt` entry)

## 7. Tests

- [x] 7.1 Update `src/__tests__/registry-client.test.ts`: add `commands`, `plugins`, `mcpServers` buckets to nested fixture; assert flattened assets include `type: 'command'`, `type: 'plugin'`, `type: 'mcp-server'`; add test for legacy `prompts` → `command` mapping
- [x] 7.2 Update `src/__tests__/claude-code-adapter.test.ts`: rename all `type: 'prompt'` fixtures to `type: 'command'`; add plugin install path test; add mcp-server merge test
- [x] 7.3 Update `src/__tests__/copilot-adapter.test.ts`: rename all `type: 'prompt'` fixtures to `type: 'command'`; add plugin install path test; add mcp-server merge + `servers` key transform test
- [x] 7.4 Update `src/__tests__/lockfile.test.ts`: add test that reading a lockfile with `type: 'prompt'` returns `type: 'command'`
- [x] 7.5 Run `pnpm typecheck && pnpm test` — all checks pass
