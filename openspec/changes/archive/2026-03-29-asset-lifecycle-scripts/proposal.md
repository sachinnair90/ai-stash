## Why

Hooks, MCP servers, and plugins are not self-contained — they frequently need API keys, endpoint URLs, dependency checks, and post-install wiring that file-copying alone cannot satisfy. Today there is no mechanism for this, so asset authors either ship incomplete assets or document manual steps that users miss.

## What Changes

- **BREAKING** Registry format gains `file` (simple assets) and `folder` (complex assets) fields, replacing the flat `files[]` array for hooks, MCP servers, and plugins. Simple asset types (skills, agents, instructions, commands) continue using `files[]`.
- **BREAKING** Folder-based assets require a `manifest.json` at the folder root that declares their files, userConfig, and scripts. The existing `manifestUrl` field is superseded for these types.
- New **declarative userConfig** system: asset authors declare named config values (sensitive or non-sensitive) in `manifest.json`; the engine prompts for them at install time, stores sensitive values in the OS keychain (falling back to `~/.config/ai-stash/credentials.json`), and substitutes non-sensitive values into asset files.
- New **imperative scripts** notification: asset authors may ship `postInstall` and `postUninstall` Node.js scripts alongside their asset; the engine never executes these — it prints a notice after install/uninstall instructing the user to run them manually.
- New **configuredFiles** declaration: files produced by substitution or setup scripts are declared in `manifest.json`, auto-added to `.gitignore` by the engine, and excluded from lockfile file tracking (preserved on update, re-prompted on sync).
- Sensitive userConfig values are **never substituted into files** — they are stored only in the keychain/credentials file and exposed as `CLAUDE_STASH_CONFIG_<KEY>` env vars for the user's script and for the target runtime.
- `dev-workflow` plugin migrated to the new folder-based structure.
- `add-asset` authoring skill updated to enforce safety checks (sensitive flag, configuredFiles declaration, Node.js-only scripts).

## Capabilities

### New Capabilities

- `asset-manifest`: Folder-based asset structure. Covers the `file` vs `folder` registry field split, `manifest.json` schema (files, userConfig, scripts, configuredFiles), and engine fetch behaviour for manifest-based assets.
- `asset-user-config`: Declarative configuration collection. Covers the userConfig prompt flow (TUI and headless), sensitive vs non-sensitive storage, keychain/credentials fallback, value substitution into non-sensitive files, and env var exposure.
- `asset-install-scripts`: Imperative script notification. Covers postInstall/postUninstall detection, user-facing notice format, `.setup-complete` sentinel scanning for status, and authoring constraints (Node.js only, no engine execution).

### Modified Capabilities

- `asset-installation`: Install flow must now fetch and parse `manifest.json` for folder-based assets, collect userConfig before writing files, auto-gitignore configuredFiles, and skip configuredFiles from lockfile tracking.
- `asset-lifecycle`: Update must preserve configuredFiles (re-prompt rather than overwrite); uninstall must surface postUninstall script notice if one is declared.

## Impact

- `src/registry/types.ts` — `RegistryAsset` gains `file?: string` and `folder?: string`; `files[]` becomes optional
- `src/registry/fetcher.ts` — new manifest fetch path for folder-based assets
- `src/engine/install.ts` — userConfig collection, substitution, configuredFiles gitignore injection
- `src/engine/update.ts` — configuredFiles preservation logic, postUninstall notice
- `src/ui/` — new userConfig prompt component for TUI
- `src/cli.tsx` / headless commands — userConfig prompt via readline for CLI mode
- `registry/registry.json` — migrate hooks, mcp-servers, plugins to `folder` field
- `registry/hooks/`, `registry/mcp-servers/`, `registry/plugins/` — add `manifest.json` per asset
- `.claude/skills/add-asset/SKILL.md` — authoring safety checks
- No new runtime dependencies required (keychain via `keytar` if already available, else credentials file)
