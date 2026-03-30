---
name: add-asset
description: Add a new asset (skill, agent, instruction, hook, command, plugin, or mcp-server) to the ai-stash registry. Creates the asset files in the correct directory and registers them in registry.json.
allowed-tools: Read, Write, Edit, Bash
---

# Add Asset

Create a new installable asset in the ai-stash registry.

This skill operates in four phases: **Brainstorm → Review → Generate → Onboard**.

---

## Phase 1 — Brainstorm (gather requirements)

### Basic questions (all asset types)

If not already provided, ask:
- **Asset name**: kebab-case identifier (e.g. `summarise-pr`, `security-review`). Must be unique across the registry.
- **Asset type**: `skill` | `agent` | `instruction` | `hook` | `command` | `plugin` | `mcp-server`
- **Description**: one sentence shown in the TUI Browse view (50 chars max before truncation)
- **Tags**: comma-separated list for search (e.g. `git, workflow, security`)
- **Targets**: which tools this asset supports — `claude-code`, `copilot`, or both
- **Content**: what should the asset actually do? Ask for a description of the behaviour, or existing content to adapt.

### Design interview (hooks, mcp-servers, plugins only)

For folder-based asset types (`hook`, `mcp-server`, `plugin`), ask these additional questions before generating anything:

1. **User configuration**: Does this asset need any user-supplied configuration (API keys, endpoints, tokens, usernames)?
   - If yes → leads to `userConfig` entries in `manifest.json`
   - For each value: **Is it sensitive** (password, token, API key) **or non-sensitive** (URL, username, project name)?
     - Sensitive values are stored in the OS keychain (or encrypted fallback). They are **never** substituted into files — only available as `CLAUDE_STASH_CONFIG_<KEY>` environment variables at runtime.
     - Non-sensitive values are stored in `~/.config/ai-stash/settings.json` and substituted into files via `${user_config.<key>}` placeholders.

2. **Setup script**: Does it need a setup step that can't be expressed declaratively (e.g. `npm install`, service registration, writing config files)?
   - If yes → leads to `scripts.postInstall` in `manifest.json`
   - Scripts must be `.js` or `.mjs` (Node.js only for cross-platform consistency)

3. **Configured files**: Will the setup step produce any output files containing user-specific values (e.g. generated config files, `.env` files)?
   - If yes → leads to `configuredFiles` in `manifest.json`
   - These files are auto-added to `.gitignore`, excluded from the lockfile, and preserved across updates

4. **Config stability**: Should configuration be preserved as-is when the asset is updated, or should the user be prompted to reconfigure?
   - If config is stable across versions → set `configStable: true` in `manifest.json`
   - If config may change between versions → leave `configStable` unset (default: user sees "reconfiguration needed" after updates)

---

## Phase 2 — Review (validate before generating)

After the interview, show a **pre-generation summary** to the user for confirmation before writing any files:

```
Asset:        {name} ({type})
Description:  {description}
Targets:      {targets}
Tags:         {tags}
Files:        {list of files to create}
userConfig:   {list of config entries with sensitive/non-sensitive labels, or "none"}
Scripts:      {postInstall and/or postUninstall paths, or "none"}
configuredFiles: {list, or "none"}
configStable: {true/false}
```

### Safety warnings

Check for and warn about each of the following (warn, not block):

- **Script extension**: If a declared script file is not `.js` or `.mjs`, warn about cross-platform risk and suggest a Node.js equivalent.
- **Sensitive value detection**: If any `userConfig` key name contains `key`, `token`, `secret`, or `password` but is not marked `sensitive: true`, warn and suggest marking it sensitive.
- **Missing configuredFiles**: If `scripts.postInstall` is declared but `configuredFiles` is empty, prompt the author to consider whether the script produces any output files that should be tracked.

Ask for confirmation before proceeding to generation.

---

## Phase 3 — Generate (scaffold files)

### Step 1 — Read the registry

```
registry/registry.json
```

Read the full file. Identify:
- The correct bucket for the asset type (see reference below)
- Whether an asset with the same name already exists in any bucket (stop and tell the user if so)
- The version format and description style used by existing assets

**Bucket reference:**

| Type | Bucket key in registry.json | Directory | Registry entry style |
|------|-----------------------------|-----------|---------------------|
| `skill` | `skills` | `registry/skills/{name}/` | `file` field |
| `agent` | `agents` | `registry/agents/{name}/` | `file` field |
| `instruction` | `instructions` | `registry/instructions/{name}/` | `file` field |
| `command` | `commands` | `registry/commands/{name}/` | `file` field |
| `hook` | `hooks` | `registry/hooks/{name}/` | `folder` field |
| `plugin` | `plugins` | `registry/plugins/{name}/` | `folder` field |
| `mcp-server` | `mcpServers` | `registry/mcp-servers/{name}/` | `folder` field |

### Step 2 — Read an existing asset of the same type

Read one existing asset of the same type to understand the expected file format:

```bash
ls registry/{bucket}/{existing-name}/
```

Then read its main file. Match its structure and frontmatter conventions.

### Step 3 — Create the asset files

#### Simple types (skill, agent, instruction, command)

These use a single content file. No manifest overhead.

**skill** — `registry/skills/{name}/SKILL.md`

```markdown
---
name: {name}
description: '{one-line description}'
allowed-tools: {comma-separated tools the skill needs, e.g. Bash, Read}
---

# {Title}

{Instructions for the coding assistant...}
```

**command** — `registry/commands/{name}/command.md`

```markdown
---
description: {one-line description}
allowed-tools: {tools}
---

# {Title}

{Instructions...}
```

**agent** — `registry/agents/{name}/agent.md`

```markdown
# {Agent Name}

{Agent persona and capability description}

## Responsibilities
...

## Behaviour
...
```

**instruction** — `registry/instructions/{name}/instruction.md`

Plain Markdown. No frontmatter. Write rules and guidelines that will be appended to `CLAUDE.md` or `AGENTS.md`. Keep it self-contained — it will be wrapped in section markers on install.

#### Folder-based types (hook, mcp-server, plugin)

For folder-based types, **always generate `manifest.json` first**, populated from interview answers.

**manifest.json** template:

```json
{
  "files": ["{relative file paths}"],
  "userConfig": {
    "{key}": { "description": "{prompt shown to user}", "sensitive": false }
  },
  "scripts": {
    "postInstall": "setup.js",
    "postUninstall": "teardown.js"
  },
  "configuredFiles": [".env", ".setup-complete"],
  "configStable": true
}
```

Rules:
- `files` is required — list every content file relative to the asset folder (do NOT include `manifest.json` itself)
- `userConfig` is optional — omit entirely if no user configuration needed
- `scripts` is optional — omit entirely if no lifecycle scripts needed
- `configuredFiles` is optional — omit entirely if no user-specific output files
- `configStable` is optional — omit or set to `true` if config values are safe across versions
- When `scripts.postInstall` is present, **always** include `.setup-complete` in `configuredFiles` (even if the author didn't mention it)

**hook** — folder-based

```
registry/hooks/{name}/
  manifest.json
  hook-config.json
  {script files as needed}
```

`hook-config.json`:
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

**mcp-server** — folder-based

```
registry/mcp-servers/{name}/
  manifest.json
  mcp.json
  {additional files as needed}
```

`mcp.json`:
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

**plugin** — folder-based

```
registry/plugins/{name}/
  manifest.json
  .claude-plugin/plugin.json
  {agents, skills, hooks subdirectories as needed}
```

Must contain `.claude-plugin/plugin.json`. List all plugin files in `manifest.json` `files` array.

#### Setup script boilerplate

When `scripts.postInstall` is declared, scaffold `setup.js` with this template:

```javascript
import { readFileSync, writeFileSync } from 'node:fs';

// Sensitive config values are available as environment variables:
// process.env.CLAUDE_STASH_CONFIG_{KEY} for each sensitive userConfig entry

async function setup() {
  // TODO: Add setup logic here
  // Example: const apiKey = process.env.CLAUDE_STASH_CONFIG_API_KEY;

  // Signal completion — must be the LAST step
  writeFileSync('.setup-complete', '');
}

setup().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
```

Include `process.env.CLAUDE_STASH_CONFIG_<KEY>` access pattern comments for each sensitive userConfig key.

### Step 4 — Add the entry to registry.json

Edit `registry/registry.json`. Find the correct bucket array and append a new entry.

**For simple types** (skill, agent, instruction, command) — use `file` field:

```json
{
  "name": "{name}",
  "version": "1.0.0",
  "description": "{description}",
  "tags": ["{tag1}", "{tag2}"],
  "targets": ["{target1}"],
  "file": "{bucket}/{name}/{filename}"
}
```

**For folder-based types** (hook, mcp-server, plugin) — use `folder` field:

```json
{
  "name": "{name}",
  "version": "1.0.0",
  "description": "{description}",
  "tags": ["{tag1}", "{tag2}"],
  "targets": ["{target1}"],
  "folder": "{bucket}/{name}"
}
```

Rules:
- `name`: must be identical to the directory name
- `version`: start at `1.0.0`
- `description`: ideally under 50 chars; no trailing punctuation
- `tags`: include relevant tool names and workflow keywords
- `targets`: only list tools whose adapters actually handle this asset type
- Do **not** include `files[]` or `manifestUrl` for folder-based entries — the engine fetches `manifest.json` from the `folder` path

---

## Phase 4 — Onboard (test and submit)

### Step 1 — Local verification

Show the user:
1. The files created with their full paths
2. The registry.json entry that was added
3. Local test command:

```bash
# Start local registry server (run in registry/)
cd registry && npx serve . --listen 3456 &

# Clear cache and run the TUI
rm -f ~/.cache/ai-stash/registry.json
REGISTRY_URL=http://localhost:3456/registry.json pnpm run dev
```

Tell the user to:
- Confirm the asset appears in the Browse view with the correct type badge and description
- Preview it (the preview pane should show the content)
- Install it and check that files land in the expected paths
- For folder-based assets: verify `manifest.json` is fetched, userConfig prompts appear, configuredFiles are gitignored, and script notice is displayed
- Verify the lockfile entry looks correct

### Step 2 — PR submission help

After generation and verification, offer: **"Would you like help creating a PR to the target registry?"**

If yes:
- Ask the developer to provide either the PR template content or a file path to the template in the target registry
- If a PR template is provided, scaffold a `gh pr create` command pre-filled with the asset name, type, description, and template body; guide the developer to review before submitting
- If no template is provided, offer a sensible default PR description covering:
  - Asset name and type
  - What it does (from the description)
  - What userConfig it collects (if any)
  - Any setup scripts the reviewer should be aware of

---

## Key rules

- Never reuse a name that already exists in any bucket
- Simple types (skill, agent, instruction, command) use `file` field in registry.json — no manifest overhead
- Folder-based types (hook, mcp-server, plugin) use `folder` field in registry.json and must include `manifest.json`
- Skills and commands must have a clear, actionable description in the frontmatter — this is what the coding assistant uses to decide when to invoke them
- For `instruction` assets: keep content focused and specific; it will be injected into the user's persistent context file
- Sensitive userConfig values are **never** written into files by the engine — only exposed as environment variables
- Scripts must be `.js` or `.mjs` (Node.js only) for cross-platform compatibility
- `.setup-complete` must always be in `configuredFiles` when `scripts.postInstall` is declared
