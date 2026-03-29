## Why

ai-stash today requires launching the full TUI to install, remove, or update assets — which blocks scripting, CI workflows, and one-liner onboarding flows. Developers need a headless CLI surface to integrate asset management into automation without an interactive terminal.

## What Changes

- New `add <type> <name>` command: installs an asset from a configured registry, with automatic single-registry selection and an interactive prompt (defaulting to first) when multiple registries exist
- New `remove <type> <name>` command: uninstalls an asset by type and name
- New `update <type> <name>` / `update --all` commands: updates one or all installed assets
- New `list` command: prints a table of installed assets (type, name, version, scope, registry)
- New `sync` command: installs all lockfile assets missing from disk (restores after `git pull`)
- Registry selection flags: `--registry <name>`, `--scope project|global`, `--target <t,...>`
- All commands exit with code 0 on success, 1 on error

## Capabilities

### New Capabilities

- `headless-asset-commands`: The full headless CLI surface — `add`, `remove`, `update`, `list`, `sync` — and their argument/flag shapes, registry selection rules, idempotency behaviour, and output format

### Modified Capabilities

_(none — existing install/update/remove engine behaviour is unchanged; the new commands are thin wrappers over existing engine functions)_

## Impact

- `src/cli.tsx`: routes new subcommand verbs before TUI render
- `src/commands/`: new files `add.ts`, `remove.ts`, `update.ts`, `list.ts`, `sync.ts`
- Engine layer (`src/engine/install.ts`, `update.ts`): called directly, no changes needed
- Registry/lockfile layer: no changes needed
- No new dependencies
