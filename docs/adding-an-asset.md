# Adding a new asset to the registry

An **asset** is a single installable item in a registry (a skill, agent, hook, etc.). Adding one means creating the asset files and registering them in `registry.json`.

## Quick checklist

- [ ] Create asset files under the correct bucket directory
- [ ] Add an entry in `registry.json` under the correct bucket
- [ ] Verify targets match what the adapters support
- [ ] Test locally with `pnpm run dev`

---

## 1. Understand the directory layout

Assets live alongside `registry.json` in a flat directory structure grouped by type:

```
registry/
  registry.json
  skills/
    my-skill/
      SKILL.md
  agents/
    my-agent/
      agent.md
  instructions/
    my-instruction/
      instruction.md
  commands/
    my-command/
      command.md
  hooks/
    my-hook/
      hook-config.json
      run.sh
  plugins/
    my-plugin/
      .claude-plugin/
        plugin.json
      agents/
        planner.md
  mcp-servers/
    my-server/
      mcp.json
```

The paths in the `files` array in `registry.json` are relative to the registry root and must match exactly.

---

## 2. Create the asset files

Each type has its own conventions:

### skill / command
A Markdown file with a YAML frontmatter block. For Claude Code skills:

```markdown
---
name: my-skill
description: What this skill does
---

# My Skill

Instructions for Claude...
```

### agent
A Markdown file describing the agent's persona and capabilities:

```markdown
# My Agent

You are a specialized agent that...

## Capabilities
...
```

### instruction
Plain Markdown that will be appended to `CLAUDE.md` or `AGENTS.md`. Keep it self-contained — it is wrapped in section markers on install:

```markdown
## My Guidelines

Always do X.
Never do Y.
```

### hook
Two files:

**`hook-config.json`** — describes the hook events and the script to run:
```json
{
  "hooks": [
    {
      "name": "my-hook",
      "event": "PostToolUse",
      "command": ".claude/hooks/my-hook/run.sh"
    }
  ]
}
```

**`run.sh`** — the shell script (must be executable in the repo):
```bash
#!/usr/bin/env bash
set -euo pipefail
# hook logic here
```

### mcp-server
A single `mcp.json` declaring the server under a `mcpServers` key:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@my-org/my-mcp-server"],
      "env": {}
    }
  }
}
```

### plugin
A directory tree rooted at `plugins/{name}/`. Must contain a manifest at `.claude-plugin/plugin.json`. The rest of the files are installed preserving the subtree structure.

---

## 3. Add the entry to registry.json

Open `registry/registry.json` and add to the correct bucket array.

### Entry schema

```json
{
  "name": "my-asset",
  "version": "1.0.0",
  "description": "One sentence description shown in the TUI",
  "tags": ["tag1", "tag2"],
  "targets": ["claude-code"],
  "files": ["skills/my-asset/SKILL.md"],
  "manifestUrl": "skills/my-asset/SKILL.md"
}
```

| Field | Notes |
|-------|-------|
| `name` | Unique within the registry. Used as the install directory name and the lockfile key. Kebab-case. |
| `version` | Semantic version string. Bump this whenever you update the asset files. |
| `description` | Shown in the Browse view. Truncated to 50 chars in the list — keep it concise. |
| `tags` | Used for search. Include relevant tool names, workflows, and capabilities. |
| `targets` | Which tools this asset supports. Valid values: `claude-code`, `copilot`. Only list targets the adapters actually handle. |
| `files` | All file paths that must be fetched from the registry server. Relative to the registry root. |
| `manifestUrl` | The primary file displayed in the preview pane. Usually the main content file. |

### Bucket reference

| Asset type | Bucket key in registry.json |
|------------|----------------------------|
| `skill` | `skills` |
| `agent` | `agents` |
| `instruction` | `instructions` |
| `command` | `commands` |
| `hook` | `hooks` |
| `plugin` | `plugins` |
| `mcp-server` | `mcpServers` |

### Example — adding a skill

```json
{
  "skills": [
    {
      "name": "summarise-pr",
      "version": "1.0.0",
      "description": "Summarise a pull request into a one-paragraph executive summary.",
      "tags": ["git", "pull-request", "documentation"],
      "targets": ["claude-code"],
      "files": ["skills/summarise-pr/SKILL.md"],
      "manifestUrl": "skills/summarise-pr/SKILL.md"
    }
  ]
}
```

---

## 4. Test locally

Start the local registry server and run the TUI:

```bash
# in the registry directory
npx serve . --listen 3456

# in another terminal, from the repo root — add the local registry then launch
ai-stash registry add http://localhost:3456/registry.json --name local
pnpm run dev
```

Clear the cache first if you made changes to an existing registry:

```bash
rm ~/.cache/ai-stash/registry.json
```

Check that:
- Your asset appears in the Browse view with the correct type badge and description
- The preview pane shows the `manifestUrl` file content
- Installing the asset writes files to the expected paths
- The lockfile records the correct entry
- Removing the asset cleans up correctly

---

## 5. Bumping an asset version

When you update an asset's files, increment `version` in `registry.json`. Users who already have the asset installed will see it appear in the **Updates** view with the old → new version diff.

Version strings are compared with strict equality (`oldVersion !== newVersion`), so any change to the version string triggers an update prompt. Use semantic versioning (`1.0.0`, `1.1.0`, `2.0.0`) by convention.
