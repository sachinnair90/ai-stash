### Requirement: Install skills for Copilot
The adapter SHALL copy skill files to the Copilot skills directory without transformation.

#### Scenario: Project skill install
- **WHEN** installing a skill at project scope
- **THEN** files are copied to `.github/skills/{name}/`

### Requirement: Install agents for Copilot
The adapter SHALL transform agent files from Claude Code format to Copilot format and install them.

#### Scenario: Transform agent file
- **WHEN** installing an agent
- **THEN** the adapter renames the file to `{name}.agent.md`, maps shared frontmatter fields (name, description, tools, model), and drops Claude-specific fields (permissionMode, maxTurns, skills, hooks, memory, background, isolation)

#### Scenario: Project agent install
- **WHEN** installing an agent at project scope
- **THEN** the transformed file is written to `.github/agents/{name}.agent.md`

### Requirement: Install instructions for Copilot
The adapter SHALL install instruction content into Copilot's instruction files, using section markers for managed content.

#### Scenario: Install as AGENTS.md
- **WHEN** installing instructions for Copilot
- **THEN** the adapter writes content to `AGENTS.md` with section markers, creating the file if it doesn't exist or appending if it does

#### Scenario: Existing copilot-instructions.md
- **WHEN** a `.github/copilot-instructions.md` exists but no `AGENTS.md`
- **THEN** the adapter appends to `.github/copilot-instructions.md` with section markers

### Requirement: Install hooks for Copilot
The adapter SHALL transform hook configuration to Copilot's hooks.json format and install hook scripts.

#### Scenario: Transform hook config
- **WHEN** installing a hook asset
- **THEN** the adapter creates or merges into `.github/hooks/hooks.json` with `version: 1` and hook entries using `bash` field (mapped from Claude's `command` field), with canonical event names mapped to Copilot's camelCase names

#### Scenario: Hook scripts
- **WHEN** a hook asset includes shell scripts
- **THEN** the adapter copies scripts to `.github/hooks/{name}/` and updates paths in hooks.json

#### Scenario: Merge with existing hooks.json
- **WHEN** `.github/hooks/hooks.json` already exists with other hooks
- **THEN** the adapter merges new hook entries into the existing event arrays without removing existing entries

### Requirement: Install prompts for Copilot
The adapter SHALL transform prompt assets to Copilot's `.prompt.md` format.

#### Scenario: Transform prompt file
- **WHEN** installing a prompt asset
- **THEN** the adapter creates `.github/prompts/{name}.prompt.md` with mapped frontmatter fields and translated variable syntax (`$ARGUMENTS` → `${input:args}`, `$0` → `${input:arg0}`)

#### Scenario: Map frontmatter fields
- **WHEN** the canonical prompt has `allowed-tools` and `description`
- **THEN** the Copilot prompt file has `tools` and `description` fields in frontmatter
