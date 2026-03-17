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

The registry index is cached at `~/.cache/ai-stash/registry.json`. If the network is unavailable, the tool falls back to the cached data and shows a staleness warning.

---

## Private registry repos

If your registry is hosted in a private GitHub repository, `ai-stash` resolves credentials automatically — no manual token setup required in most cases.

### Automatic credential resolution

On startup the tool tries the following in order, stopping at the first success:

1. **`GITHUB_TOKEN` environment variable** — explicit override, useful in CI
2. **GitHub CLI** (`gh auth token`) — if you have `gh` installed and are logged in
3. **Git credential manager** — the same credentials used to clone private repos (macOS Keychain, Windows Credential Manager, GNOME Keyring, etc.)

If none of these resolve a token the tool falls back to unauthenticated requests, which works fine for public registries.

### Pointing at a private registry

Update `~/.config/ai-stash/config.json`:

```json
{
  "registry": {
    "name": "my-private-registry",
    "url": "https://raw.githubusercontent.com/my-org/my-registry/main/registry.json"
  },
  "cacheTTL": 3600,
  "defaultTarget": "claude-code"
}
```

Then ensure one of the following is true:

- You are authenticated with the GitHub CLI: `gh auth login`
- Your git credential manager has credentials for `github.com` (true if you can `git clone` the private repo)
- You have `GITHUB_TOKEN` set in your environment

### CI / non-interactive environments

Set `GITHUB_TOKEN` explicitly before running the tool:

```bash
GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }} npx ai-stash
```

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

Commit this file to share your AI assistant setup with your team — see [Sharing a setup with your team](#sharing-a-setup-with-your-team) for the full workflow.

---

## Testing

### Unit and integration tests

Run the full test suite with Vitest:

```bash
pnpm run test
```

Seven test suites cover the core layers:

| File | What it tests |
|------|---------------|
| `claude-code-adapter.test.ts` | File path mapping and content transforms for the Claude Code adapter |
| `copilot-adapter.test.ts` | File path mapping and content transforms for the Copilot adapter |
| `install-engine.test.ts` | `planInstall`, `dryRunInstall`, and `executeInstall` — conflict detection and file writing |
| `tui-install.test.ts` | `installAsset()` — the TUI-facing wrapper used by the Install view; regression guard for the adapter registration path |
| `registry-client.test.ts` | Registry fetch, disk caching, TTL, and offline fallback |
| `lockfile.test.ts` | Lockfile read, write, and schema validation |
| `integration.test.ts` | Full install → update → remove lifecycle against a temp directory |

Run a single file:

```bash
pnpm exec vitest run src/__tests__/tui-install.test.ts
```

### End-to-end TUI test

`scripts/e2e-tui-test.py` launches the real app in a PTY, drives it with simulated keystrokes, and verifies the full install flow from the user's perspective:

```bash
python3 scripts/e2e-tui-test.py
```

This requires a registry server to be running locally (the app's configured registry URL must be reachable). It walks through:

1. Browse view renders with assets loaded
2. `i` opens the Install view with scope selection
3. Selecting `project` scope and confirming `claude-code` target runs the install
4. "Installation complete!" is shown with a `✓` checkmark per file
5. The file is physically present on disk
6. The lockfile records the correct file path (non-empty `files` array)

---

## Sharing a setup with your team

`ai-stash.lock.json` records exactly which assets are installed, at which version, and with which options. Committing it to your repository lets teammates reproduce the same AI assistant setup in a few keystrokes.

### Setting up (one person)

1. Run `npx ai-stash` in your project root and install the assets your team needs
2. Commit the generated lockfile:

```bash
git add ai-stash.lock.json
git commit -m "chore: add ai-stash asset lockfile"
```

### Bootstrapping from a shared lockfile (everyone else)

When a teammate clones the repository the lockfile is already present but the asset files are not yet installed locally. One command syncs everything:

1. Run `npx ai-stash` from the project root
2. The footer shows **`s sync (N)`** in yellow — the number of assets missing locally
3. Press `s` to open the **Sync** view, which lists every uninstalled asset with its recorded version, scope, and targets
4. Press `y` to confirm — all missing assets are installed automatically using the exact scope and targets from the lockfile

No prompts, no manual selection. The sync reads everything it needs from the lockfile.

### Keeping the team in sync

When someone adds or updates an asset they commit the updated lockfile. Other team members see the change in `git diff ai-stash.lock.json`, then:

1. Press `u` in the TUI to open the **Updates** view
2. Any asset whose lockfile version is behind the registry version appears here — press `u` to update one or `U` to update all

### What the lockfile records

Each installed asset entry captures everything needed to reproduce the installation:

```json
"code-review": {
  "type": "skill",
  "version": "1.0.0",
  "installedAt": "2026-03-17T10:00:00Z",
  "targets": ["claude-code"],
  "scope": "project",
  "files": [".claude/skills/code-review/SKILL.md"]
}
```

| Field | Meaning |
|-------|---------|
| `type` | Asset type (`skill`, `agent`, `instruction`, etc.) |
| `version` | Installed version — used to detect when updates are available |
| `targets` | Which tools were targeted (`claude-code`, `copilot`, or both) |
| `scope` | `project` (files in repo) or `global` (files in `~/.claude/`) |
| `files` | Exact paths written — used to cleanly remove the asset later |

> **Global-scope assets** (`scope: "global"`) are written to `~/.claude/` or `~/.config/github-copilot/` and are personal to each developer. Committing a lockfile that contains global-scope assets is fine — teammates will be prompted to install them, but the files will land in their own home directory, not the repo.

---

## Contributing

The registry is a separate Git repository. To publish your own skill, agent, or prompt, open a PR against the registry repo with a `manifest.json` and the asset files in the appropriate type folder.

---

## License

MIT
