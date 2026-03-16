# High-Level Requirements: `ai-stash` — AI Asset Manager TUI

## 1. Overview

A terminal-based interactive tool (TUI) that lets developers browse, install, update, and manage AI coding assistant assets — skills, agents, and instruction files — sourced from one or more Git repositories. Works with Claude Code and GitHub Copilot out of the box, and is extensible to other assistants.

**Install command:**

```bash
npx github:your-org/ai-stash
# or after publishing to npm:
npx ai-stash
```

---

## 2. Core Concepts

**Asset types** the tool understands and installs:

- **Skills** — reusable prompt templates or capability modules (e.g. SKILL.md files)
- **Agents** — agent definitions with tools, personas, and system prompts
- **Instruction files** — global or repo-level instructions (e.g. `CLAUDE.md`, `.github/copilot-instructions.md`)
- **Hooks** - user-defined shell commands that execute at specific points in AI assistants' lifecycle
- **Prompts** - standalone prompt templates that can be used across tools

**Registries** — one or more Git repos (GitHub, GitLab, self-hosted) that act as asset sources. Users can add multiple registries.

**Targets** — the AI tools being configured (Claude Code, GitHub Copilot, etc.)

---

## 3. Functional Requirements

### 3.1 Asset Browsing

- Display a searchable, filterable list of available assets from all configured registries
- Show asset metadata: name, description, version, author, type, tags, last updated
- Allow previewing asset contents before installing
- Support filtering by asset type, tag, or target tool

### 3.2 Asset Installation

- Install selected assets to the correct location for each target tool
- Support per-project install (relative path) and global install (`~/.config/...`)
- Detect conflicts with existing files and offer merge/overwrite/skip
- Record installed assets in a local lockfile (e.g. `aitool.lock.json`) for reproducibility

### 3.3 Registry Management

- Add, remove, and list registries (stored in `~/.config/aitool/config.json`)
- Support public and private repos (SSH key / token auth)
- Allow setting a default registry
- Cache registry index locally with a configurable TTL

### 3.4 Update & Remove

- Check for newer versions of installed assets
- Selectively update individual assets or all at once
- Remove installed assets cleanly (undo file placements)

### 3.5 Target Tool Adapters

Each adapter knows where to place files for a given tool:

| Target | Install path | File format |
|---|---|---|
| Claude Code (global) | `~/.claude/` | SKILL.md, CLAUDE.md |
| Claude Code (project) | `.claude/` or `CLAUDE.md` | Markdown |
| GitHub Copilot | `.github/copilot-instructions.md` | Markdown |

Adapters are pluggable — new targets can be added via config or plugins.

---

## 4. Non-Functional Requirements

- **Zero global install friction** — fully runnable via `npx` with no prior setup
- **Offline capable** — cached registry data used when network is unavailable, with clear staleness warnings
- **Cross-platform** — works on macOS, Linux, and Windows (WSL at minimum)
- **Fast** — registry index fetch and render should complete in under 2 seconds on typical connections
- **Non-destructive** — never silently overwrite existing files; always prompt or dry-run

---

## 5. TUI UX Requirements

- Arrow key navigation for browsing asset lists
- Multi-select for bulk install
- Live search/filter as you type
- Preview pane showing asset content alongside the list
- Progress indicators for network operations
- Keyboard shortcut help footer (e.g. `?` opens help)
- Color-coded asset types and install status

**Recommended TUI library:** [Ink](https://github.com/vadimdemedes/ink) (React for CLIs, Node.js) or [Blessed](https://github.com/chjj/blessed)

---

## 6. Configuration

`~/.config/aitool/config.json`:

```json
{
  "registries": [
    { "name": "official", "url": "https://github.com/your-org/assets", "default": true },
    { "name": "team",     "url": "git@github.com:your-team/ai-assets" }
  ],
  "cacheTTL": 3600,
  "defaultTarget": "claude-code"
}
```

---

## 7. Asset Manifest Format

Each asset in a registry includes a `manifest.json`:

```json
{
  "name": "docx-skill",
  "version": "1.2.0",
  "type": "skill",
  "description": "Creates professional Word documents",
  "targets": ["claude-code"],
  "tags": ["documents", "office"],
  "files": [{ "src": "SKILL.md", "dest": "skills/{name}/SKILL.md" }]
}
```

---

## 8. npm Packaging & Distribution

- Published as an npm package with `"bin"` field pointing to the CLI entry
- `npx github:user/repo` works via GitHub's npm-compatible package serving
- Node.js ≥18 required (for native `fetch`, ESM support)
- Minimal dependencies — keep the install fast
- Include a `postinstall` check that validates the runtime environment

---

## 9. Out of Scope (v1)

- GUI/web interface
- Asset authoring wizard (create new assets, only install existing ones) - planned for v2, with configurable templates, scaffolding and review features
  - For v1 TUI can help the user to convert existing files into the correct format for installation, but not create new assets from scratch
- Auto-sync / watch mode
- VS Code extension wrapper
- Multi-registry asset merging (e.g. deduping assets from multiple sources)
- Multi-registry support for v1 — users can only configure one registry, but the architecture allows for multiple in the future
- Dynamic asset molding based on the installed assistant's capabilities (e.g. only show compatible assets) - planned for v2 with richer metadata and compatibility checks