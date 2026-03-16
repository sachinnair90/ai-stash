# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # Install dependencies
pnpm run dev          # Run directly with tsx (no build step)
pnpm run build        # Compile TypeScript to dist/ and add shebang
pnpm run test         # Run all tests with Vitest
pnpm run typecheck    # Type-check without emitting files
```

Run a single test file:
```bash
pnpm exec vitest run src/__tests__/install-engine.test.ts
```

## Architecture

**ai-stash** is a terminal UI (TUI) app built with React + Ink for managing AI assistant assets (skills, agents, hooks, instructions, prompts) for Claude Code and GitHub Copilot.

### Layers

```
UI Layer      src/ui/          React/Ink components and views
Engine Layer  src/engine/      Install/update/remove orchestration
Registry      src/registry/    Fetch + disk-cache asset metadata
Adapters      src/adapters/    Platform-specific file path transforms
Config        src/config/      User config (~/.config/ai-stash/)
Lockfile      src/lockfile/    Track installed assets (ai-stash.lock.json)
```

### Data flow

1. `src/cli.tsx` — entry point, renders `App`
2. `src/ui/App.tsx` — loads registry + lockfile, routes between views (browse / install / updates / installed), handles keyboard input
3. **Install path:** `planInstall()` fetches asset files and detects conflicts → `executeInstall()` writes files and updates lockfile
4. **Update/remove path:** `checkUpdates()` compares lockfile to registry → `updateAssetFull()` / `removeAssetFull()`

### Adapters

Each adapter (`claude-code`, `copilot`) implements the `Adapter` interface from `src/adapters/types.ts`:
- `getInstallPaths()` — maps asset types to target directories (e.g., skills → `.claude/skills/`)
- `transformFiles()` — rewrites file contents for the target platform
- `mergeIntoExisting()` — handles merging into files like `CLAUDE.md`
- `removeAsset()` — cleans up installed files

### Registry

The registry client fetches `registry.json` from a remote URL, caches to disk with a 3600s TTL, and falls back to cache on network failure. Stale cache triggers a warning in the UI.

### Testing

Six test suites under `src/__tests__/`: integration lifecycle, install engine, update engine, registry client, lockfile, and adapter transformations. Tests use Vitest with mocked fetch and temporary directories.
