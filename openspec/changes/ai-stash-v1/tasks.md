## 1. Project Scaffold

- [ ] 1.1 Initialize npm package with TypeScript, ESM, bin entry point, and Node ≥18 engines field
- [ ] 1.2 Configure TypeScript (tsconfig.json) with strict mode, ESM output, and path aliases
- [ ] 1.3 Add core dependencies: Ink, React, simple-git/degit (or fetch-based alternative)
- [ ] 1.4 Add dev dependencies: vitest, @types/react, tsx
- [ ] 1.5 Create CLI entry point (`src/cli.tsx`) that boots the Ink app
- [ ] 1.6 Implement Node.js version check with clear error message for <18

## 2. Configuration

- [ ] 2.1 Define config schema types (`Config`, `Registry` interfaces)
- [ ] 2.2 Implement config loader: read `~/.config/ai-stash/config.json`, create with defaults on first run
- [ ] 2.3 Implement cross-platform path resolution (home dir, project root detection)

## 3. Registry Client

- [ ] 3.1 Define `registry.json` TypeScript types (`RegistryIndex`, `RegistryAsset`)
- [ ] 3.2 Implement registry fetcher: fetch `registry.json` from GitHub raw content URL
- [ ] 3.3 Implement cache layer: store at `~/.config/ai-stash/cache/registry.json` with TTL check
- [ ] 3.4 Implement offline fallback: use stale cache when network fails, show staleness warning
- [ ] 3.5 Implement individual asset file fetcher: download files by path from registry on demand
- [ ] 3.6 Handle unknown registry version with warning

## 4. Lockfile Management

- [ ] 4.1 Define lockfile schema types (`Lockfile`, `InstalledAsset`)
- [ ] 4.2 Implement lockfile reader: parse `ai-stash.lock.json` from project root
- [ ] 4.3 Implement lockfile writer: create/update lockfile with installed asset entries
- [ ] 4.4 Implement installed asset lookup: check if an asset is installed, compare versions

## 5. Adapter System

- [ ] 5.1 Define adapter interface: `getInstallPath`, `transformFiles`, `mergeIntoExisting`, `removeAsset`
- [ ] 5.2 Implement adapter registry: map of target tool name → adapter instance

## 6. Claude Code Adapter

- [ ] 6.1 Implement skill installer: copy files to `.claude/skills/{name}/` (project) or `~/.claude/skills/{name}/` (global)
- [ ] 6.2 Implement agent installer: copy to `.claude/agents/{name}.md`
- [ ] 6.3 Implement instruction installer: append to `CLAUDE.md` with section markers
- [ ] 6.4 Implement hook installer: merge into `.claude/settings.json` hooks, copy scripts to `.claude/hooks/{name}/`
- [ ] 6.5 Implement prompt installer: create as skill with `disable-model-invocation: true`
- [ ] 6.6 Implement removal for all asset types (delete files, remove section markers, unmerge hooks)

## 7. Copilot Adapter

- [ ] 7.1 Implement skill installer: copy files to `.github/skills/{name}/`
- [ ] 7.2 Implement agent installer: transform frontmatter (drop Claude-specific fields), rename to `.agent.md`, write to `.github/agents/`
- [ ] 7.3 Implement instruction installer: append to `AGENTS.md` (or `copilot-instructions.md`) with section markers
- [ ] 7.4 Implement hook installer: transform to `.github/hooks/hooks.json` format (map event names, `command` → `bash`), copy scripts
- [ ] 7.5 Implement prompt installer: transform to `.github/prompts/{name}.prompt.md` (map frontmatter, `$ARGUMENTS` → `${input:args}`)
- [ ] 7.6 Implement removal for all asset types

## 8. Install Engine

- [ ] 8.1 Implement core install flow: fetch asset files → select adapter → transform → write files → update lockfile
- [ ] 8.2 Implement conflict detection: check existing files against lockfile (managed vs unmanaged)
- [ ] 8.3 Implement merge/overwrite/skip conflict resolution prompts
- [ ] 8.4 Implement dry-run mode: show planned changes without writing
- [ ] 8.5 Implement multi-target install: run adapter for each selected target tool

## 9. Update & Remove Engine

- [ ] 9.1 Implement update checker: compare lockfile versions against registry
- [ ] 9.2 Implement single asset update: fetch new version, replace files, update lockfile
- [ ] 9.3 Implement bulk update: update all outdated assets with progress
- [ ] 9.4 Implement asset removal: delete placed files, clean up section markers, remove lockfile entry
- [ ] 9.5 Implement removal confirmation prompt

## 10. TUI - Core Layout

- [ ] 10.1 Create Ink app shell with main layout (list pane + preview pane + footer)
- [ ] 10.2 Implement keyboard shortcut footer with `?` for full help overlay
- [ ] 10.3 Implement help overlay with all keyboard shortcuts

## 11. TUI - Asset List

- [ ] 11.1 Implement scrollable asset list component with name, type badge (color-coded), description, version
- [ ] 11.2 Implement arrow key navigation with highlight tracking
- [ ] 11.3 Implement install status indicators (installed, update available) from lockfile
- [ ] 11.4 Implement multi-select with toggle keyboard shortcut and selection count

## 12. TUI - Search & Filter

- [ ] 12.1 Implement live search input that filters assets by name, description, and tags
- [ ] 12.2 Implement type filter (skills, agents, instructions, hooks, prompts)
- [ ] 12.3 Implement target tool filter (claude-code, copilot)
- [ ] 12.4 Implement combined filter state (search + type + target applied together)

## 13. TUI - Preview Pane

- [ ] 13.1 Implement preview pane that shows content of highlighted asset
- [ ] 13.2 Fetch and display asset file content on highlight (with loading indicator)
- [ ] 13.3 Implement scrollable preview for long content

## 14. TUI - Install Flow

- [ ] 14.1 Implement scope selection prompt (project / global)
- [ ] 14.2 Implement target tool selection (checkboxes, default all compatible)
- [ ] 14.3 Implement install progress view (per-file status indicators)
- [ ] 14.4 Implement conflict resolution UI (merge / overwrite / skip / view diff)
- [ ] 14.5 Implement bulk install flow for multi-selected assets

## 15. TUI - Update & Remove Views

- [ ] 15.1 Implement installed assets view (list with version, scope, targets)
- [ ] 15.2 Implement update view with update-available indicators and bulk update action
- [ ] 15.3 Implement remove confirmation view showing files to be deleted

## 16. Testing

- [ ] 16.1 Unit tests for registry client (fetch, cache, offline fallback)
- [ ] 16.2 Unit tests for lockfile management (read, write, version comparison)
- [ ] 16.3 Unit tests for Claude Code adapter (all 5 asset types install + remove)
- [ ] 16.4 Unit tests for Copilot adapter (all 5 asset types transform + install + remove)
- [ ] 16.5 Unit tests for install engine (conflict detection, dry-run, multi-target)
- [ ] 16.6 Integration tests for full install/update/remove cycle

## 17. Packaging & Distribution

- [ ] 17.1 Configure build pipeline (TypeScript → JS, bundle for npm)
- [ ] 17.2 Verify `npx ai-stash` works from clean environment
- [ ] 17.3 Verify `npx github:org/ai-stash` works from GitHub
- [ ] 17.4 Add postinstall environment validation check
