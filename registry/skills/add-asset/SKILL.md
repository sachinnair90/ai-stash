---
name: add-asset
description: Add a new asset (skill, agent, instruction, hook, command, plugin, or mcp-server) to the ai-stash registry. Creates the asset files in the correct directory and registers them in registry.json.
allowed-tools: Read, Write, Edit, Bash
---

# Add Asset

Create a new installable asset in the ai-stash registry.

## What to ask the user first

If not already provided:
- **Asset name**: kebab-case identifier (e.g. `summarise-pr`, `security-review`). Must be unique across the registry.
- **Asset type**: `skill` | `agent` | `instruction` | `hook` | `command` | `plugin` | `mcp-server`
- **Description**: one sentence shown in the TUI Browse view (50 chars max before truncation)
- **Tags**: comma-separated list for search (e.g. `git, workflow, security`)
- **Targets**: which tools this asset supports — `claude-code`, `copilot`, or both
- **Content**: what should the asset actually do? Ask for a description of the behaviour, or existing content to adapt.

## Step 1 — Read the registry

```
registry/registry.json
```

Read the full file. Identify:
- The correct bucket for the asset type (see reference below)
- Whether an asset with the same name already exists in any bucket (stop and tell the user if so)
- The version format and description style used by existing assets

**Bucket reference:**

| Type | Bucket key in registry.json | Directory |
|------|-----------------------------|-----------|
| `skill` | `skills` | `registry/skills/{name}/` |
| `agent` | `agents` | `registry/agents/{name}/` |
| `instruction` | `instructions` | `registry/instructions/{name}/` |
| `command` | `commands` | `registry/commands/{name}/` |
| `hook` | `hooks` | `registry/hooks/{name}/` |
| `plugin` | `plugins` | `registry/plugins/{name}/` |
| `mcp-server` | `mcpServers` | `registry/mcp-servers/{name}/` |

## Step 2 — Read an existing asset of the same type

Read one existing asset of the same type to understand the expected file format:

```bash
ls registry/{bucket}/{existing-name}/
```

Then read its main file. Match its structure and frontmatter conventions.

## Step 3 — Create the asset files

Create the directory and files. Follow the format conventions per type:

### skill
`registry/skills/{name}/SKILL.md`

```markdown
---
name: {name}
description: '{one-line description}'
allowed-tools: {comma-separated tools the skill needs, e.g. Bash, Read}
---

# {Title}

{Instructions for the coding assistant...}
```

### command
`registry/commands/{name}/command.md`

```markdown
---
description: {one-line description}
allowed-tools: {tools}
---

# {Title}

{Instructions...}
```

### agent
`registry/agents/{name}/agent.md`

```markdown
# {Agent Name}

{Agent persona and capability description}

## Responsibilities
...

## Behaviour
...
```

### instruction
`registry/instructions/{name}/instruction.md`

Plain Markdown. No frontmatter. Write rules and guidelines that will be appended to `CLAUDE.md` or `AGENTS.md`. Keep it self-contained — it will be wrapped in section markers on install.

### hook
Two files:

`registry/hooks/{name}/hook-config.json`
```json
{
  "hooks": [
    {
      "name": "{name}",
      "event": "PostToolUse",
      "command": ".claude/hooks/{name}/run.sh"
    }
  ]
}
```

`registry/hooks/{name}/run.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

# Hook logic here
```

### mcp-server
`registry/mcp-servers/{name}/mcp.json`
```json
{
  "mcpServers": {
    "{name}": {
      "command": "npx",
      "args": ["-y", "@scope/package-name"],
      "env": {}
    }
  }
}
```

### plugin
A directory tree under `registry/plugins/{name}/`. Must contain `.claude-plugin/plugin.json`. Add all plugin files and list every one in the `files` array in `registry.json`.

## Step 4 — Add the entry to registry.json

Edit `registry/registry.json`. Find the correct bucket array and append a new entry:

```json
{
  "name": "{name}",
  "version": "1.0.0",
  "description": "{description}",
  "tags": ["{tag1}", "{tag2}"],
  "targets": ["{target1}"],
  "files": ["{bucket}/{name}/{filename}"],
  "manifestUrl": "{bucket}/{name}/{main-file}"
}
```

Rules for each field:
- `name`: must be identical to the directory name
- `version`: start at `1.0.0`
- `description`: ideally under 50 chars; no trailing punctuation
- `tags`: include the asset type implicitly, add tool names and workflow keywords
- `targets`: only list tools whose adapters actually handle this asset type
- `files`: list every file in the asset directory — the install engine fetches all of them
- `manifestUrl`: the primary content file shown in the TUI preview pane

## Step 5 — Verify

Show the user:
1. The files created with their full paths
2. The registry.json entry that was added
3. Local test command:

```bash
# Start local registry server (run in registry/)
npx serve . --listen 3456 &

# Clear cache and run the TUI
rm -f ~/.cache/ai-stash/registry.json
REGISTRY_URL=http://localhost:3456/registry.json pnpm run dev
```

Tell the user to:
- Confirm the asset appears in the Browse view with the correct type badge and description
- Preview it (the preview pane should show the `manifestUrl` content)
- Install it and check that files land in the expected paths
- Verify the lockfile entry looks correct

## Key rules

- Never reuse a name that already exists in any bucket
- All paths in `files` must be relative to the registry root and must match actual file locations exactly
- `manifestUrl` must be one of the paths already listed in `files`
- Skills and commands must have a clear, actionable description in the frontmatter — this is what the coding assistant uses to decide when to invoke them
- For `instruction` assets: keep content focused and specific; it will be injected into the user's persistent context file
- For `hook` assets: ensure `run.sh` has a shebang line and `set -euo pipefail`
