## Why

The registry now supports `commands`, `plugins`, and `mcp-servers` as first-class asset types, but ai-stash only recognises `skill`, `agent`, `instruction`, `hook`, and `prompt`. Adding the three new types and aligning the `prompt` → `command` rename makes the tool and registry consistent, letting users discover and install all asset types from the TUI.

## What Changes

- **BREAKING** Rename asset type `prompt` → `command` throughout: `AssetType` union, both adapters, `NestedRegistryIndex`, `BUCKET_TO_TYPE`, specs, and tests
- Add `plugin` asset type: adapters copy plugin directories (including `.claude-plugin/` manifest, `agents/`, `skills/`, `hooks/`) to the target tool's plugin directory
- Add `mcp-server` asset type: adapters merge `mcpServers` entries from the asset's `mcp.json` into the target tool's MCP config file (`.mcp.json` for Claude Code, `.vscode/mcp.json` for Copilot), using the same merge pattern as hooks
- Update TUI type filter and color badges to include `command`, `plugin`, and `mcp-server`; drop `prompt`

## Capabilities

### New Capabilities

_(none — all changes are modifications to existing capabilities)_

### Modified Capabilities

- `registry-client`: `NestedRegistryIndex` gains `commands?`, `plugins?`, `mcpServers?` buckets; removes `prompts?`; `BUCKET_TO_TYPE` map updated accordingly
- `asset-browsing`: Type filter list and color badge map updated to replace `prompt` with `command` and add `plugin`, `mcp-server`
- `adapter-system`: `AssetType` union gains `'command'`, `'plugin'`, `'mcp-server'`; removes `'prompt'`
- `claude-code-adapter`: `case 'prompt'` renamed to `case 'command'`; new `case 'plugin'` copies files to `.claude/plugins/{name}/`; new `case 'mcp-server'` merges `mcpServers` into `.mcp.json`
- `copilot-adapter`: `case 'prompt'` renamed to `case 'command'`; new `case 'plugin'` copies files to `.github/plugins/{name}/`; new `case 'mcp-server'` merges `mcpServers` into `.vscode/mcp.json`

## Impact

- **`src/adapters/types.ts`** — `AssetType` union: remove `'prompt'`, add `'command'`, `'plugin'`, `'mcp-server'`
- **`src/registry/types.ts`** — `NestedRegistryIndex`: replace `prompts?` with `commands?`, add `plugins?` and `mcpServers?`
- **`src/registry/fetcher.ts`** — `BUCKET_TO_TYPE`: replace `prompts: 'prompt'` with `commands: 'command'`, add `plugins: 'plugin'` and `mcpServers: 'mcp-server'`
- **`src/adapters/claude-code/index.ts`** — rename `'prompt'` case, add `'plugin'` and `'mcp-server'` cases in `getInstallPaths`, `transformFiles`, `mergeIntoExisting`, `removeAsset`
- **`src/adapters/copilot/index.ts`** — same adapter changes
- **`src/ui/`** — wherever `'prompt'` type string appears in filters, badges, or labels
- **`src/__tests__/`** — any test fixtures using `type: 'prompt'` → `type: 'command'`; new tests for plugin and mcp-server handling
