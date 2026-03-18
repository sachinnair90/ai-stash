## 1. Project Scaffold

- [x] 1.1 Initialize npm package with TypeScript, ESM, bin entry point, and Node ≥18 engines field
- [x] 1.2 Configure TypeScript (tsconfig.json) with strict mode, ESM output, and path aliases
- [x] 1.3 Add core dependencies: Ink, React, simple-git/degit (or fetch-based alternative)
- [x] 1.4 Add dev dependencies: vitest, @types/react, tsx
- [x] 1.5 Create CLI entry point (`src/cli.tsx`) that boots the Ink app
- [x] 1.6 Implement Node.js version check with clear error message for <18

## 2. Configuration

- [x] 2.1 Define config schema types (`Config`, `Registry` interfaces)
- [x] 2.2 Implement config loader: read `~/.config/ai-stash/config.json`, create with defaults on first run
- [x] 2.3 Implement cross-platform path resolution (home dir, project root detection)

## 3. Registry Client

- [x] 3.1 Define `registry.json` TypeScript types (`RegistryIndex`, `RegistryAsset`)
- [x] 3.2 Implement registry fetcher: fetch `registry.json` from GitHub raw content URL
- [x] 3.3 Implement cache layer: store at `~/.config/ai-stash/cache/registry.json` with TTL check
- [x] 3.4 Implement offline fallback: use stale cache when network fails, show staleness warning
- [x] 3.5 Implement individual asset file fetcher: download files by path from registry on demand
- [x] 3.6 Handle unknown registry version with warning

## 4. Lockfile Management

- [x] 4.1 Define lockfile schema types (`Lockfile`, `InstalledAsset`)
- [x] 4.2 Implement lockfile reader: parse `ai-stash.lock.json` from project root
- [x] 4.3 Implement lockfile writer: create/update lockfile with installed asset entries
- [x] 4.4 Implement installed asset lookup: check if an asset is installed, compare versions

## 5. Adapter System

- [x] 5.1 Define adapter interface: `getInstallPath`, `transformFiles`, `mergeIntoExisting`, `removeAsset`
- [x] 5.2 Implement adapter registry: map of target tool name → adapter instance

## 6. Claude Code Adapter

- [x] 6.1 Implement skill installer: copy files to `.claude/skills/{name}/` (project) or `~/.claude/skills/{name}/` (global)
- [x] 6.2 Implement agent installer: copy to `.claude/agents/{name}.md`
- [x] 6.3 Implement instruction installer: append to `CLAUDE.md` with section markers
- [x] 6.4 Implement hook installer: merge into `.claude/settings.json` hooks, copy scripts to `.claude/hooks/{name}/`
- [x] 6.5 Implement prompt installer: create as skill with `disable-model-invocation: true`
- [x] 6.6 Implement removal for all asset types (delete files, remove section markers, unmerge hooks)

## 7. Copilot Adapter

- [x] 7.1 Implement skill installer: copy files to `.github/skills/{name}/`
- [x] 7.2 Implement agent installer: transform frontmatter (drop Claude-specific fields), rename to `.agent.md`, write to `.github/agents/`
- [x] 7.3 Implement instruction installer: append to `AGENTS.md` (or `copilot-instructions.md`) with section markers
- [x] 7.4 Implement hook installer: transform to `.github/hooks/hooks.json` format (map event names, `command` → `bash`), copy scripts
- [x] 7.5 Implement prompt installer: transform to `.github/prompts/{name}.prompt.md` (map frontmatter, `$ARGUMENTS` → `${input:args}`)
- [x] 7.6 Implement removal for all asset types

## 8. Install Engine

- [x] 8.1 Implement core install flow: fetch asset files → select adapter → transform → write files → update lockfile
- [x] 8.2 Implement conflict detection: check existing files against lockfile (managed vs unmanaged)
- [x] 8.3 Implement merge/overwrite/skip conflict resolution prompts
- [x] 8.4 Implement dry-run mode: show planned changes without writing
- [x] 8.5 Implement multi-target install: run adapter for each selected target tool

## 9. Update & Remove Engine

- [x] 9.1 Implement update checker: compare lockfile versions against registry
- [x] 9.2 Implement single asset update: fetch new version, replace files, update lockfile
- [x] 9.3 Implement bulk update: update all outdated assets with progress
- [x] 9.4 Implement asset removal: delete placed files, clean up section markers, remove lockfile entry
- [x] 9.5 Implement removal confirmation prompt

## 10. TUI - Core Layout

- [x] 10.1 Create Ink app shell with main layout (list pane + preview pane + footer)
- [x] 10.2 Implement keyboard shortcut footer with `?` for full help overlay
- [x] 10.3 Implement help overlay with all keyboard shortcuts

## 11. TUI - Asset List

- [x] 11.1 Implement scrollable asset list component with name, type badge (color-coded), description, version
- [x] 11.2 Implement arrow key navigation with highlight tracking
- [x] 11.3 Implement install status indicators (installed, update available) from lockfile
- [x] 11.4 Implement multi-select with toggle keyboard shortcut and selection count

## 12. TUI - Search & Filter

- [x] 12.1 Implement live search input that filters assets by name, description, and tags
- [x] 12.2 Implement type filter (skills, agents, instructions, hooks, prompts)
- [x] 12.3 Implement target tool filter (claude-code, copilot)
- [x] 12.4 Implement combined filter state (search + type + target applied together)

## 13. TUI - Preview Pane

- [x] 13.1 Implement preview pane that shows content of highlighted asset
- [x] 13.2 Fetch and display asset file content on highlight (with loading indicator)
- [x] 13.3 Implement scrollable preview for long content

## 14. TUI - Install Flow

- [x] 14.1 Implement scope selection prompt (project / global)
- [x] 14.2 Implement target tool selection (checkboxes, default all compatible)
- [x] 14.3 Implement install progress view (per-file status indicators)
- [x] 14.4 Implement conflict resolution UI (merge / overwrite / skip / view diff)
- [x] 14.5 Implement bulk install flow for multi-selected assets

## 15. TUI - Update & Remove Views

- [x] 15.1 Implement installed assets view (list with version, scope, targets)
- [x] 15.2 Implement update view with update-available indicators and bulk update action
- [x] 15.3 Implement remove confirmation view showing files to be deleted

## 16. Testing

- [x] 16.1 Unit tests for registry client (fetch, cache, offline fallback)
- [x] 16.2 Unit tests for lockfile management (read, write, version comparison)
- [x] 16.3 Unit tests for Claude Code adapter (all 5 asset types install + remove)
- [x] 16.4 Unit tests for Copilot adapter (all 5 asset types transform + install + remove)
- [x] 16.5 Unit tests for install engine (conflict detection, dry-run, multi-target)
- [x] 16.6 Integration tests for full install/update/remove cycle

## 17. Packaging & Distribution

- [x] 17.1 Configure build pipeline (TypeScript → JS, bundle for npm)
- [x] 17.2 Verify `npx ai-stash` works from clean environment
- [x] 17.3 Verify `npx github:org/ai-stash` works from GitHub
- [x] 17.4 Add postinstall environment validation check
