## Context

This is a greenfield Node.js/TypeScript CLI tool. No existing codebase. The project bootstraps from an empty repo with only the OpenSpec change artifacts.

The AI coding assistant ecosystem has converged on file-based configuration: skills (SKILL.md), agents (markdown with frontmatter), instructions (CLAUDE.md / AGENTS.md), hooks (JSON config + shell scripts), and prompts/slash commands. Anthropic published the Agent Skills format as an open standard at agentskills.io, and GitHub Copilot adopted it — meaning skills are already portable. Other asset types are close but not identical between tools.

Key constraint: the tool must be zero-friction (`npx ai-stash`) with no prior setup required.

## Goals / Non-Goals

**Goals:**
- Provide a single TUI to browse, install, update, and remove AI assistant assets
- Support all 5 asset types: skills, agents, instructions, hooks, prompts
- Install assets correctly for both Claude Code and GitHub Copilot via adapters
- Use a single curated Git-based registry with a CI-generated index
- Store canonical assets in Claude Code format (the superset), with adapters transforming for other tools
- Track installed assets via a lockfile for reproducible updates and clean removal
- Work offline with cached registry data

**Non-Goals:**
- Multiple registries / BYOR (v2)
- Asset authoring wizard / scaffolding (v2)
- Auto-sync or watch mode
- VS Code extension wrapper
- GUI/web interface
- Dynamic compatibility checking based on assistant capabilities (v2)

## Decisions

### D1: TypeScript + Ink for the TUI

**Decision**: Use TypeScript with Ink (React for CLIs) as the TUI framework.

**Rationale**: Ink provides React's component model for terminal UIs — composable, declarative, with built-in support for flexbox layout, input handling, and text styling. It's actively maintained and has a strong ecosystem (ink-select-input, ink-text-input, ink-spinner). TypeScript gives type safety across the adapter system and manifest parsing.

**Alternatives considered**:
- Blessed: Powerful but unmaintained since 2017. Risk of unpatched bugs.
- @inquirer/prompts: Great for linear flows but lacks the split-pane, live-search TUI we need.
- Bubbletea (Go): Excellent TUI library but would require Go runtime, breaking the `npx` zero-install model.

### D2: Claude Code format as canonical registry format

**Decision**: Store all assets in the registry using Claude Code's native format. Copilot adapter transforms from this format.

**Rationale**: Claude Code's format is the superset — its agent frontmatter has more fields (permissionMode, maxTurns, skills, hooks, memory, background, isolation) than Copilot's (target, mcp-servers). Skills follow the shared open standard. "Downgrading" from a richer format to a simpler one is straightforward; the reverse would lose information.

**Alternatives considered**:
- Target-neutral canonical format: Requires inventing and maintaining a third format nobody writes natively. Extra abstraction with no clear benefit.
- Per-target variants in registry: Duplicates content, increases authoring burden, risks drift between variants.

### D3: Convention + metadata hybrid for registry structure

**Decision**: Registry repo uses type-based folders (skills/, agents/, instructions/, hooks/, prompts/) for human browsability, plus a CI-generated `registry.json` for TUI consumption.

```
registry/
├── skills/
│   └── {name}/
│       ├── manifest.json
│       └── SKILL.md (+ supporting files)
├── agents/
│   └── {name}/
│       ├── manifest.json
│       └── agent.md
├── instructions/
│   └── {name}/
│       ├── manifest.json
│       └── CLAUDE.md
├── hooks/
│   └── {name}/
│       ├── manifest.json
│       ├── hook-config.json
│       └── *.sh
├── prompts/
│   └── {name}/
│       ├── manifest.json
│       └── SKILL.md
├── registry.json              # CI-generated index
└── .github/workflows/
    └── build-index.yml
```

**Rationale**: Folders serve humans browsing on GitHub. `registry.json` serves the TUI. CI keeps them in sync. When BYOR comes in v2, new registries just need to produce a valid `registry.json` — folder structure becomes a convention, not a requirement.

### D4: Adapters own destination paths

**Decision**: Asset authors specify only the asset content and metadata. Adapters determine where files go for each target tool.

**Rationale**: Authors shouldn't need to know Claude Code's `~/.claude/skills/` or Copilot's `.github/agents/` paths. If a tool changes its directory conventions, we update one adapter, not every manifest. This also enables the "install for both" flow — one asset, two adapters, correct placement for each.

**Adapter path mapping**:

| Asset Type   | Claude Code (project)              | Claude Code (global)         | Copilot (project)                    |
|-------------|-------------------------------------|------------------------------|--------------------------------------|
| Skills      | `.claude/skills/{name}/`            | `~/.claude/skills/{name}/`   | `.github/skills/{name}/`             |
| Agents      | `.claude/agents/{name}.md`          | `~/.claude/agents/{name}.md` | `.github/agents/{name}.agent.md`     |
| Instructions| `CLAUDE.md` (append/section)        | `~/.claude/CLAUDE.md`        | `AGENTS.md` or `copilot-instructions.md` |
| Hooks       | `.claude/settings.json` (merge)     | `~/.claude/settings.json`    | `.github/hooks/hooks.json` (merge)   |
| Prompts     | `.claude/skills/{name}/SKILL.md`    | `~/.claude/skills/{name}/`   | `.github/prompts/{name}.prompt.md`   |

### D5: Lockfile for state tracking

**Decision**: Use `ai-stash.lock.json` in the project root to track installed assets.

```json
{
  "version": 1,
  "registry": "https://github.com/org/ai-assets",
  "installed": {
    "docx-skill": {
      "type": "skill",
      "version": "1.2.0",
      "installedAt": "2026-03-16T12:00:00Z",
      "targets": ["claude-code", "copilot"],
      "scope": "project",
      "files": [
        ".claude/skills/docx-skill/SKILL.md",
        ".github/skills/docx-skill/SKILL.md"
      ]
    }
  }
}
```

**Rationale**: The lockfile enables: update checking (compare installed version vs registry), clean removal (know exactly which files were placed), reproducibility (another dev can see what's installed), and conflict detection (know if a file was placed by ai-stash).

### D6: Registry fetching via GitHub raw content

**Decision**: Fetch `registry.json` via GitHub's raw content URL (or GitHub API for private repos). Cache locally at `~/.config/ai-stash/cache/` with configurable TTL. Fetch individual asset files on-demand during install.

**Rationale**: Avoids cloning the entire registry repo. `registry.json` is small (metadata only). Individual asset files are fetched only when the user chooses to install. This keeps the initial load fast (<2s target) and bandwidth minimal.

**Alternatives considered**:
- Full git clone: Too slow for `npx` cold start. Registry could be large.
- GitHub API (tree/blob): Works but rate-limited for unauthenticated requests. Raw content is simpler.

### D7: Adapter transformation strategies

Each asset type requires a different transformation approach:

- **Skills**: Zero transform. Copy files as-is. Both tools use the Agent Skills open standard.
- **Agents**: Light transform. Rename `.md` → `.agent.md` for Copilot. Map shared frontmatter fields (name, description, tools, model). Drop Claude-specific fields (permissionMode, maxTurns, etc.).
- **Prompts**: Moderate transform. Claude stores as SKILL.md with `disable-model-invocation: true`. Copilot stores as `.prompt.md`. Map `$ARGUMENTS` → `${input:args}`, translate frontmatter fields.
- **Hooks**: Moderate transform. Claude merges into settings.json `hooks` object. Copilot writes `.github/hooks/hooks.json`. Map event names (PreToolUse → preToolUse). Transform config shape (`command` → `bash`/`powershell`). Copy shared shell scripts.
- **Instructions**: Significant transform. Claude uses `CLAUDE.md`. Copilot uses `AGENTS.md` or `copilot-instructions.md`. Content may need section markers (`<!-- ai-stash:{name} -->`) for managed sections within these files, enabling install/update/remove of individual instruction assets.

### D8: Conflict handling strategy

**Decision**: When installing an asset would overwrite an existing file, the TUI presents three options: merge (for appendable files like CLAUDE.md), overwrite, or skip. For files managed by ai-stash (tracked in lockfile), updates overwrite by default. For unmanaged files, always prompt.

Section markers (`<!-- ai-stash:{name} -->` / `<!-- /ai-stash:{name} -->`) are used for instruction files and hook configs that merge into existing files, enabling clean per-asset updates and removal.

## Risks / Trade-offs

- **[Ink bundle size]** Ink + React adds ~2MB to the package. → Acceptable for an npx tool; users don't install globally. Tree-shake where possible.
- **[GitHub rate limits]** Unauthenticated raw content requests are limited. → Cache aggressively with TTL. Support GitHub token in config for private repos / higher limits.
- **[Format drift]** Claude Code or Copilot may change their file formats. → Adapter pattern isolates changes. Version adapters independently. Monitor tool changelogs.
- **[Single-file merging]** Instructions and hooks merge into shared files (CLAUDE.md, settings.json, hooks.json). → Section markers enable per-asset management. Risk of user editing managed sections — detect and warn on mismatch.
- **[Offline registry staleness]** Cached registry.json may be outdated. → Show clear staleness warnings with cache age. Never silently use stale data without indicating it.
