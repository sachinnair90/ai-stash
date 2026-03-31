# AI Co-Author Hook

Automatically tags git commits with AI attribution trailers — supporting both
**Claude Code** and **GitHub Copilot coding agent** — with zero manual work.

```text
Co-authored-by: GitHub Copilot <github-copilot[bot]@users.noreply.github.com>
AI-modified: src/auth/login.ts
AI-modified: src/auth/session.ts
```

The `AI-modified:` trailers are real git trailers (not comments) and persist in
the commit object, making AI contributions queryable across history:

```bash
git log --grep="AI-modified: src/auth"
git log --grep="Co-authored-by: GitHub Copilot"
```

All scripts are **Node.js** — no bash, no PowerShell — so they work on Linux,
macOS, and Windows (Git Bash / WSL).

---

## How it works

### Claude Code

```text
Claude edits a file
     │
     ▼  PostToolUse hook fires
hooks/track-ai-edits.mjs
     │  git hash-object <file>   — hash content at write time
     │  write model ID to .git/.ai_session_meta
     ▼
.git/.ai_session_files           — <blob-hash>\t<path>  per line

Session ends → Stop hook → session-stop.mjs prints summary

  git add .  &&  git commit -m "feat: add login flow"
       │
       ▼  prepare-commit-msg git hook fires (injects trailers during commit)
  Reads .git/.ai_session_meta for model name
  For each AI-touched file that is staged:
    ├─ Exact match?   staged blob == AI hash              → tag
    ├─ Similar?       >= 70% of AI's lines present        → tag
    ├─ Discarded?     < 70% overlap                       → skip
    ├─ Generated?     lockfile / minified                 → tag without check
    └─ Binary?        NUL bytes detected                  → tag without check
       │
       ▼  post-commit hook fires
  Clears .git/.ai_session_files and .git/.ai_session_meta
```

### GitHub Copilot coding agent

```text
Copilot agent session starts
     │
     ▼  sessionStart hook → hooks/session-start.mjs
  Installs git hooks from .github/hooks/git/ into .git/hooks/
  (fresh checkout has no .git/hooks — must be re-installed each run)

Copilot edits a file (postToolUse: toolName = edit|create)
     │
     ▼  postToolUse hook → hooks/track-ai-edits.mjs   (same script)
  Records file + hash in .git/.ai_session_files

Session ends → sessionEnd hook → hooks/session-stop.mjs prints summary

Copilot runs 'git commit'  →  prepare-commit-msg fires (same script)
  Detects GITHUB_COPILOT_AGENT / COPILOT_AGENT_ID env vars → blanket-tags all staged files
  (no per-file similarity check needed in agent mode)
```

---

## Installation

### Prerequisites

- Node.js ≥ 18
- git in your `$PATH`

### Claude Code setup

```bash
# Project-level (recommended)
node install.mjs --claude

# Global (all Claude Code projects)
node install.mjs --claude --global

# Global git hooks template (new repos pick it up automatically)
node install.mjs --claude --git-global
```

### GitHub Copilot coding agent setup

```bash
node install.mjs --copilot
```

Then **commit** the generated `.github/hooks/` directory:

```bash
git add .github/hooks/
git commit -m "chore: add AI co-author hooks for Copilot"
```

The `sessionStart` hook will install the git hooks automatically when the agent
checks out the repository.

### Both at once

```bash
node install.mjs --claude --copilot
```

---

## File layout

```text
registry/hooks/ai-coauthor-hook/
  README.md
  hook-config.json          ← Claude Code hooks config (for ai-stash install)
  copilot-hooks.json        ← Template written to .github/hooks/hooks.json
  install.mjs               ← Installer (Node.js)
  hooks/
    track-ai-edits.mjs      ← PostToolUse / postToolUse handler
    session-stop.mjs        ← Stop / sessionEnd handler
    session-start.mjs       ← Copilot sessionStart: installs git hooks
  scripts/
    prepare-commit-msg.mjs  ← Git hook: appends attribution trailers
    post-commit.mjs         ← Git hook: clears session state after commit
```

After running `--copilot`, the following is written to your repo:

```text
.github/hooks/
  hooks.json                ← Copilot hooks config (committed)
  track-ai-edits.mjs        ← postToolUse hook script
  session-stop.mjs          ← sessionEnd hook script
  session-start.mjs         ← sessionStart hook script (installs git hooks)
  git/
    prepare-commit-msg.mjs  ← git hook source (installed at sessionStart)
    post-commit.mjs         ← git hook source (installed at sessionStart)
```

---

## Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `AI_SIMILARITY_THRESHOLD` | `70` | Minimum % of AI-written lines that must still be in the staged file to count as AI-assisted |
| `AI_ASSISTANT` | — | Set to `copilot` to force Copilot attribution for the current shell session |

---

## Manual session management (local Copilot)

For VS Code Copilot Chat / Edit mode (not the coding agent), flag the session manually:

```bash
export AI_ASSISTANT=copilot
# edit with Copilot...
git add .
git commit -m "feat: ..."
```

When `AI_ASSISTANT=copilot` is set **without** `track-ai-edits` running, the hook
adds a `Co-authored-by` trailer but cannot add `AI-modified:` lines (since file-level
tracking data is not available). If `track-ai-edits` is also active — for example via
Claude Code hooks or Copilot agent hooks — per-file `AI-modified:` trailers will be
included as normal.

To cancel before committing:

```bash
unset AI_ASSISTANT
```

### Generic fallback identity

When an AI tool records edits via `track-ai-edits.mjs` but no `.ai_session_meta`
is written (e.g. a third-party integration), the hook uses a generic identity:

```text
Co-authored-by: AI Assistant <ai-assistant@users.noreply.github.com>
```

---

## Comparing with `claude-coauthor-hook`

| Feature | `claude-coauthor-hook` | `ai-coauthor-hook` |
| --- | --- | --- |
| Runtimes | Bash + Python | **Node.js only** |
| OS support | Unix/macOS | **Linux, macOS, Windows** |
| Claude Code hooks | ✅ | ✅ |
| Copilot coding agent hooks | ❌ (manual only) | ✅ |
| Per-file hash tracking | ✅ | ✅ |
| Similarity threshold | ✅ | ✅ |
| sessionStart auto-install | ❌ | ✅ |
