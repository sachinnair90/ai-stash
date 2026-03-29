# Sample Registry

This directory contains a sample registry for `ai-stash` with artifacts sourced from [github/awesome-copilot](https://github.com/github/awesome-copilot).

## Structure

```
registry/
├── registry.json                   # Registry index — consumed by ai-stash
├── skills/
│   ├── git-commit/                 # Skill: conventional git commits (Claude Code)
│   ├── conventional-commit/        # Skill: XML-structured commit messages (both)
│   ├── code-review/                # Skill: tiered code review (both)
│   ├── add-asset/                  # Skill: add assets to the registry (both)
│   └── create-adapter/             # Skill: scaffold a new adapter (both)
├── agents/
│   ├── debug-agent/                # Agent: systematic four-phase debugger (both)
│   └── planner/                    # Agent: structured planning assistant (both)
├── instructions/
│   ├── code-review/                # Instruction: generic code review guidelines (both)
│   ├── secure-coding/              # Instruction: secure coding standards (both)
│   └── security-owasp/            # Instruction: OWASP Top 10 secure coding rules (both)
├── hooks/
│   └── post-edit-typecheck/        # Hook: typecheck after file edits (Claude Code)
├── commands/
│   └── write-pr-description/       # Command: generate PR descriptions (both)
├── mcp-servers/
│   └── github/                     # MCP server: GitHub integration config
└── plugins/
    └── dev-workflow/               # Plugin: bundled dev workflow assets
```

## Assets

| Name | Type | Targets | Source |
|------|------|---------|--------|
| `git-commit` | skill | claude-code | awesome-copilot |
| `conventional-commit` | skill | copilot, claude-code | awesome-copilot |
| `debug-agent` | agent | copilot, claude-code | awesome-copilot |
| `code-review` | instruction | copilot, claude-code | awesome-copilot |
| `security-owasp` | instruction | copilot, claude-code | awesome-copilot |

## Using locally

Serve the registry with any static file server and point `ai-stash` at it:

```bash
# Serve with npx
npx serve registry/

# Then configure ai-stash to use it
mkdir -p ~/.config/ai-stash
cat > ~/.config/ai-stash/config.json <<EOF
{
  "registry": {
    "name": "local",
    "url": "http://localhost:3000/registry.json"
  }
}
EOF

npx ai-stash
```

## File path note

Asset `files` paths are relative to the registry root. The engine resolves fetch URLs via `new URL(filePath, registryUrl)`, so files at `skills/git-commit/SKILL.md` are served at the correct path when the registry is hosted. For standard assets (skills, agents, instructions, commands, hooks), the basename is used for the install destination — `SKILL.md` installs to `.claude/skills/git-commit/SKILL.md`. For plugin assets, subpaths under `plugins/{name}/` are preserved at the install destination.

## Script Risk Model

Assets that include lifecycle scripts (declared in `scripts.postInstall` / `scripts.postUninstall` in their `manifest.json`) require explicit developer acceptance before installation.

**What ai-stash guarantees:**
- Scripts are **never executed automatically** — they are surfaced for manual review only
- A mandatory risk disclaimer is shown and must be explicitly accepted before install proceeds
- Script content is hashed at install time; if the hash changes on update, re-acceptance is required

**What ai-stash does NOT guarantee:**
- Script analysis, sandboxing, or safety validation
- Rollback of script side effects on failure
- Cross-platform compatibility of scripts

**Trust chain:**
`Registry` → (reviews author submission) → `Author` → `SCRIPT_RISKS.md` → `Developer acceptance`

**Author obligations for scripted assets:**
1. Provide a `SCRIPT_RISKS.md` documenting what the script installs, modifies, and how to undo
2. Declare `postUninstall` or document manual cleanup steps in `SCRIPT_RISKS.md`
3. Set `"hasScripts": true` in the `registry.json` entry for the asset
4. Set `"scriptRisks": "path/to/SCRIPT_RISKS.md"` in `manifest.json` pointing to the documentation file
