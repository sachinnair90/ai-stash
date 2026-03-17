### Requirement: Install skills for Claude Code
The adapter SHALL copy skill files (SKILL.md + supporting files) to the Claude Code skills directory without any transformation.

#### Scenario: Project skill install
- **WHEN** installing a skill at project scope
- **THEN** files are copied to `.claude/skills/{name}/`

#### Scenario: Global skill install
- **WHEN** installing a skill at global scope
- **THEN** files are copied to `~/.claude/skills/{name}/`

### Requirement: Install agents for Claude Code
The adapter SHALL copy agent markdown files to the Claude Code agents directory without transformation.

#### Scenario: Project agent install
- **WHEN** installing an agent at project scope
- **THEN** the agent file is copied to `.claude/agents/{name}.md`

#### Scenario: Global agent install
- **WHEN** installing an agent at global scope
- **THEN** the agent file is copied to `~/.claude/agents/{name}.md`

### Requirement: Install instructions for Claude Code
The adapter SHALL install instruction content into `CLAUDE.md`, using section markers for managed content.

#### Scenario: No existing CLAUDE.md
- **WHEN** installing instructions and no `CLAUDE.md` exists
- **THEN** the adapter creates `CLAUDE.md` with the instruction content wrapped in section markers

#### Scenario: Existing CLAUDE.md
- **WHEN** installing instructions and `CLAUDE.md` already exists
- **THEN** the adapter appends the instruction content as a new marked section at the end of the file

#### Scenario: Global instructions
- **WHEN** installing instructions at global scope
- **THEN** the adapter writes to `~/.claude/CLAUDE.md`

### Requirement: Install hooks for Claude Code
The adapter SHALL merge hook configuration into Claude Code's settings format, copying hook scripts to an accessible location. File entries in `asset.files` are treated as registry-root-relative paths; only the basename is used when determining local filenames and filtering config files.

#### Scenario: Install hook
- **WHEN** installing a hook asset
- **THEN** the adapter merges the hook events into `.claude/settings.json` under the `hooks` key, mapping canonical event names to Claude Code event names (e.g., `preToolUse` → `PreToolUse`)

#### Scenario: Hook scripts
- **WHEN** a hook asset includes shell scripts alongside a `hook-config.json`
- **THEN** the adapter copies scripts (all files whose basename is not `hook-config.json`) to `.claude/hooks/{name}/` using the basename of each file entry as the local filename, and updates the hook config command paths

#### Scenario: Hook config filter uses basename
- **WHEN** `asset.files` contains a registry-root-relative path such as `hooks/my-hook/hook-config.json`
- **THEN** the adapter correctly identifies it as the config file (by basename) and does not copy it as a script file

### Requirement: Install prompts for Claude Code
The adapter SHALL install prompts as Claude Code skills with `disable-model-invocation: true` in the frontmatter.

#### Scenario: Install prompt as skill
- **WHEN** installing a prompt asset
- **THEN** the adapter creates `.claude/skills/{name}/SKILL.md` with `disable-model-invocation: true` added to the frontmatter

#### Scenario: Preserve existing frontmatter
- **WHEN** the prompt already has frontmatter fields
- **THEN** the adapter preserves all existing fields and adds `disable-model-invocation: true`
