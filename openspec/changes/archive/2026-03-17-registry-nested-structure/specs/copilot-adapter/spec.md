## MODIFIED Requirements

### Requirement: Install hooks for Copilot
The adapter SHALL transform hook configuration to Copilot's hooks.json format and install hook scripts. File entries in `asset.files` are treated as registry-root-relative paths; `hook-config.json` is identified by a suffix check so full paths are handled correctly.

#### Scenario: Transform hook config
- **WHEN** installing a hook asset
- **THEN** the adapter creates or merges into `.github/hooks/hooks.json` with `version: 1` and hook entries using `bash` field (mapped from Claude's `command` field), with canonical event names mapped to Copilot's camelCase names

#### Scenario: Hook config identified by suffix
- **WHEN** `asset.files` contains a registry-root-relative path such as `hooks/my-hook/hook-config.json`
- **THEN** the adapter correctly identifies it as the hook config entry (via `endsWith('hook-config.json')`) and applies the hook transformation

#### Scenario: Hook scripts
- **WHEN** a hook asset includes shell scripts
- **THEN** the adapter copies scripts to `.github/hooks/{name}/` using the basename of each file entry as the local filename, and updates paths in hooks.json

#### Scenario: Merge with existing hooks.json
- **WHEN** `.github/hooks/hooks.json` already exists with other hooks
- **THEN** the adapter merges new hook entries into the existing event arrays without removing existing entries
