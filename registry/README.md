# Sample Registry

This directory contains a sample registry for `ai-stash` with artifacts sourced from [github/awesome-copilot](https://github.com/github/awesome-copilot).

## Structure

```
registry/
├── registry.json           # Registry index — consumed by ai-stash
└── assets/
    ├── git-commit/         # Skill: conventional git commits (Claude Code)
    ├── conventional-commit/ # Skill: XML-structured commit messages (both)
    ├── debug-agent/        # Agent: systematic four-phase debugger (both)
    ├── code-review/        # Instruction: generic code review guidelines (both)
    └── security-owasp/     # Instruction: OWASP Top 10 secure coding rules (both)
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

Asset `files` paths are relative to `registry.json`. The engine resolves fetch URLs via `new URL(filePath, registryUrl)`, so files at `assets/git-commit/SKILL.md` are served at the correct path when the registry is hosted. Only the basename is used for the local install destination, so `SKILL.md` installs to `.claude/skills/git-commit/SKILL.md` regardless of its registry subdirectory path.
