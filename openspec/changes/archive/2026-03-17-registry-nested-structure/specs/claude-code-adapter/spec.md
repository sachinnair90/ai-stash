## MODIFIED Requirements

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
