## Why

Developers using AI coding assistants (Claude Code, GitHub Copilot) spend significant time manually crafting and maintaining skills, agents, instructions, hooks, and prompt templates. There's no standard way to share, discover, or install these assets across a team — let alone across different AI tools. Each assistant has its own file formats and conventions, making portability painful.

`ai-stash` solves this by providing a TUI that connects developers to a curated registry of reusable AI assets, handles the format differences between assistants, and installs assets to the correct locations — all via a zero-setup `npx` command.

## What Changes

- New CLI tool `ai-stash` published as an npm package, runnable via `npx ai-stash`
- Interactive TUI (built with Ink) for browsing, searching, filtering, and previewing assets from a Git-based registry
- Support for 5 asset types: skills, agents, instructions, hooks, and prompts
- Pluggable adapter system that installs assets to the correct locations for Claude Code and GitHub Copilot
- Registry consumption: fetches and caches a CI-generated `registry.json` index from a single official Git registry
- Asset installation with conflict detection (merge/overwrite/skip), supporting both project-local and global installs
- Local lockfile (`ai-stash.lock.json`) tracking installed assets for update and removal
- Update checking and selective asset updates
- Clean asset removal (undo file placements)

## Capabilities

### New Capabilities
- `registry-client`: Fetching, caching, and consuming the registry index (`registry.json`) from a Git-based registry. Includes cache TTL, offline fallback, and staleness warnings.
- `asset-browsing`: TUI interface for browsing, searching, filtering, and previewing assets. Includes list navigation, live search, multi-select, preview pane, and keyboard shortcuts.
- `asset-installation`: Installing assets to the correct locations for each target tool. Includes conflict detection, project vs global scope, lockfile management, and dry-run support.
- `asset-lifecycle`: Checking for updates, selectively updating assets, and cleanly removing installed assets.
- `adapter-system`: Pluggable adapter architecture that transforms and places assets per target tool. Ships with Claude Code and GitHub Copilot adapters.
- `claude-code-adapter`: Adapter for installing all 5 asset types to Claude Code locations with correct formats.
- `copilot-adapter`: Adapter for installing all 5 asset types to GitHub Copilot locations, transforming from the canonical Claude Code format.
- `cli-scaffold`: npm package structure, CLI entry point, configuration management (`~/.config/ai-stash/config.json`), and `npx` zero-install support.

### Modified Capabilities
_(none — greenfield project)_

## Impact

- **New package**: Entire `ai-stash` npm package (TypeScript, Node.js ≥18)
- **Dependencies**: Ink (TUI), simple-git or degit (registry fetch), minimal others
- **File system**: Writes to `.claude/`, `.github/`, `~/.claude/`, `~/.copilot/`, `~/.config/ai-stash/`
- **Network**: Fetches `registry.json` from a Git repo (GitHub API or raw content)
- **No breaking changes**: Greenfield — no existing code affected
