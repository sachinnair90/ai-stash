# ai-stash

Bootstrap your coding assistant setup with reusable skills, agents, and instructions via an interactive TUI.

`ai-stash` is a zero-setup CLI tool for browsing, installing, updating, and removing AI assistant assets — skills, agents, instructions, hooks, and prompts — for both **Claude Code** and **GitHub Copilot**.

```
npx ai-stash
```

---

## Prerequisites

- **Node.js ≥ 18** (required — the tool will exit with a clear error on older versions)
- **npm** or any package manager that supports `npx`
- Network access to fetch the asset registry (works offline with cached data)

---

## Installation

### Zero-install (recommended)

No installation required. Run directly with npx:

```bash
npx ai-stash
```

On first run, npx downloads the package and launches the TUI. Subsequent runs use the npm cache.

### Global install

```bash
npm install -g ai-stash
ai-stash
```

### From GitHub (latest unreleased)

```bash
npx github:ai-stash/ai-stash
```

---

## How to Use

### Browsing assets

When the TUI launches it fetches the asset registry and shows a split-pane browser:

```
ai-stash | Browse
─────────────────────────────────────────────────────────
/ Search assets...

[ ] ● [skill]  docx-reader      Read Word documents          v1.2.0
[ ]   [agent]  code-reviewer    Review PRs with suggestions  v0.8.0
[ ]   [prompt] commit-message   Generate commit messages      v1.0.0
                                 │ Name: docx-reader
                                 │ Type: skill
                                 │ Version: 1.2.0
                                 │ ...
─────────────────────────────────────────────────────────
/  search   i  install   u  updates   l  installed   ?  help   q  quit
```

**Navigation:**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate the asset list |
| `Space` | Toggle multi-select |
| `/` | Open live search (filters by name, description, tags) |
| `Escape` | Clear search |
| `PageUp` / `PageDown` | Scroll the preview pane |
| `?` | Show full keyboard shortcut help |
| `q` | Quit |

**Status indicators:**

| Icon | Meaning |
|------|---------|
| `●` (green) | Installed and up to date |
| `↑` (yellow) | Update available |
| _(empty)_ | Not installed |

### Installing an asset

1. Navigate to an asset (or select multiple with `Space`)
2. Press `i` to install
3. Choose **scope**: `project` (writes to current directory) or `global` (writes to `~/.claude/`)
4. Choose **target tools**: `claude-code`, `copilot`, or both
5. Watch per-file progress; resolve any conflicts (merge / overwrite / skip)

### Updating assets

Press `u` to open the Updates view. Assets with newer registry versions are listed with version diffs.

- `u` — update the highlighted asset
- `U` — update all outdated assets
- `Escape` — go back

### Managing installed assets

Press `l` to open the Installed view — lists every asset tracked in `ai-stash.lock.json`.

- `r` on a selected asset — opens a confirmation screen showing which files will be deleted
- `y` to confirm removal, `n` or `Escape` to cancel

---

## Asset types

| Type | Description | Claude Code location | Copilot location |
|------|-------------|---------------------|-----------------|
| **skill** | Reusable slash commands | `.claude/skills/{name}/` | `.github/skills/{name}/` |
| **agent** | Sub-agent definitions | `.claude/agents/{name}.md` | `.github/agents/{name}.agent.md` |
| **instruction** | Persistent context added to CLAUDE.md / AGENTS.md | `CLAUDE.md` | `AGENTS.md` |
| **hook** | Event-triggered shell scripts | `.claude/settings.json` + scripts | `.github/hooks/hooks.json` + scripts |
| **prompt** | Slash-command prompt templates | `.claude/skills/{name}/SKILL.md` | `.github/prompts/{name}.prompt.md` |

---

## Configuration

On first run, `ai-stash` creates `~/.config/ai-stash/config.json` with defaults:

```json
{
  "registry": {
    "name": "ai-stash-registry",
    "url": "https://raw.githubusercontent.com/ai-stash/registry/main/registry.json"
  },
  "cacheTTL": 3600,
  "defaultTarget": "claude-code"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `registry.url` | string | URL to the `registry.json` index |
| `registry.name` | string | Display name for the registry |
| `cacheTTL` | number | Cache lifetime in **seconds** (default: 3600 = 1 hour) |
| `defaultTarget` | string | Default install target (`claude-code` or `copilot`) |
| `githubToken` | string _(optional)_ | GitHub token for private registries or higher rate limits |

The registry index is cached at `~/.cache/ai-stash/registry.json`. If the network is unavailable, the tool falls back to the cached data and shows a staleness warning.

---

## Lockfile

Every install writes to `ai-stash.lock.json` in your project root:

```json
{
  "version": 1,
  "registry": "https://raw.githubusercontent.com/ai-stash/registry/main/registry.json",
  "installed": {
    "docx-reader": {
      "type": "skill",
      "version": "1.2.0",
      "installedAt": "2026-03-16T12:00:00Z",
      "targets": ["claude-code", "copilot"],
      "scope": "project",
      "files": [
        ".claude/skills/docx-reader/SKILL.md",
        ".github/skills/docx-reader/SKILL.md"
      ]
    }
  }
}
```

Commit this file to share your AI assistant setup with your team.

---

## Contributing

The registry is a separate Git repository. To publish your own skill, agent, or prompt, open a PR against the registry repo with a `manifest.json` and the asset files in the appropriate type folder.

---

## License

MIT
