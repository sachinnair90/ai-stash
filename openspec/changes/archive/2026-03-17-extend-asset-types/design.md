## Context

`AssetType` currently has five members: `skill | agent | instruction | hook | prompt`. The registry has moved to seven types — renaming `prompts` to `commands` and adding `plugins` and `mcp-servers`. Every type flows through: `NestedRegistryIndex` / `BUCKET_TO_TYPE` (parsing), `AssetType` (type system), both adapters (install paths + transforms), the TUI (filters + badges), and tests.

The three changes are independent in scope but land together because they all touch the same type union and adapter switch blocks.

## Goals / Non-Goals

**Goals:**
- Rename `prompt` → `command` everywhere with no behavioural change (adapters still install commands the same way they installed prompts)
- Add `plugin` type: copy the full plugin directory tree to the target tool's plugin directory
- Add `mcp-server` type: merge `mcpServers` entries into the target tool's MCP config file (`.mcp.json` for Claude Code, `.vscode/mcp.json` for Copilot)
- Update TUI type filter and color badges to reflect the new set

**Non-Goals:**
- Plugin activation/enabling in Claude Code settings — just file installation
- MCP server startup or validation — just config file merging
- Supporting global scope for Copilot (it has no meaningful global plugin/MCP path)

## Decisions

### Decision 1: Plugin install paths

**Chosen:** Strip the `plugins/{name}/` registry prefix and recreate the subtree under the target tool's plugin directory.

```
registry path:  plugins/dev-workflow/.claude-plugin/plugin.json
→ install path: .claude/plugins/dev-workflow/.claude-plugin/plugin.json   (Claude Code project)
               ~/.claude/plugins/dev-workflow/.claude-plugin/plugin.json  (Claude Code global)
               .github/plugins/dev-workflow/.claude-plugin/plugin.json    (Copilot project)
```

In `getInstallPaths`:
```ts
case 'plugin':
  return asset.files.map(f => {
    const rel = f.replace(new RegExp(`^plugins/${asset.name}/`), '');
    return path.join(base, 'plugins', asset.name, rel);
  });
```

`transformFiles`: passthrough — plugin files are copied as-is.
`removeAsset`: delete `.claude/plugins/{name}/` (or `.github/plugins/{name}/`) recursively.

**Alternative considered:** Flatten the plugin files into the standard agent/skill/hook directories. Rejected — loses the plugin namespace, breaks plugin invocation via `/plugin-name:skill-name`.

---

### Decision 2: MCP server merge strategy

**Chosen:** Merge by server key, same pattern as hook merging. The asset's `mcp.json` uses Claude Code's `mcpServers` format; the Copilot adapter transforms `mcpServers` → `servers` (Copilot's `.vscode/mcp.json` format).

Install paths:
- Claude Code project: `{projectRoot}/.mcp.json`
- Claude Code global: `~/.claude/mcp.json`
- Copilot project: `.vscode/mcp.json`

`mergeIntoExisting` (Claude Code): merge `mcpServers` objects by key — new keys are added, existing keys are overwritten.

`mergeIntoExisting` (Copilot): transform `mcpServers` → `servers`, merge into `.vscode/mcp.json`.

`removeAsset`: remove the specific server key(s) from the config file.

**Alternative considered:** Write a separate `.mcp.json` per asset. Rejected — MCP config files must be singular per project; multiple files would be ignored.

---

### Decision 3: `prompt` → `command` rename

Pure rename — no behaviour change. The Claude Code adapter continues to install commands as skills with `disable-model-invocation: true`. The Copilot adapter continues to install commands as `.prompt.md` files (the file format name is separate from the asset type name).

All `case 'prompt':` blocks become `case 'command':`. All `type: 'prompt'` in test fixtures become `type: 'command'`. `NestedRegistryIndex.prompts` → `commands`. `BUCKET_TO_TYPE` entry updated.

---

### Decision 4: TUI color for new types

Extend the existing color badge map:
- `command` — purple (was `prompt`'s color, preserves visual continuity)
- `plugin` — cyan
- `mcp-server` — orange

## Risks / Trade-offs

**Risk:** Existing lockfiles with `type: "prompt"` break after rename → **Mitigation:** Add a read-time normalisation in the lockfile reader: if `type === 'prompt'`, coerce to `'command'`. Document as a one-version migration.

**Risk:** Plugin directory removal is recursive — accidental data loss if install path is wrong → **Mitigation:** `removeAsset` only deletes `{base}/plugins/{name}/`, never a path outside of the plugin namespace.

**Risk:** `.mcp.json` may not exist on first install → **Mitigation:** `mergeIntoExisting` is called only when the file exists; `executeInstall` falls through to a plain write for new files. The initial write is `{ "mcpServers": { ... } }` from `transformFiles`.

## Migration Plan

1. Rename `AssetType` — TypeScript will surface every unhandled case at compile time
2. Update adapters (compile errors guide the work)
3. Add lockfile read-time coercion for `prompt` → `command`
4. Update `NestedRegistryIndex` + `BUCKET_TO_TYPE`
5. Update TUI
6. Update tests
7. Run `pnpm typecheck && pnpm test`
