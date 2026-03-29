## ADDED Requirements

### Requirement: Collect userConfig values at install time
The system SHALL prompt the user for each value declared in `manifest.json` `userConfig` before writing any asset files. Each entry SHALL have a `description` (prompt text) and a `sensitive` boolean flag.

#### Scenario: Non-sensitive value prompt
- **WHEN** a manifest declares a non-sensitive userConfig key
- **THEN** the engine displays the description and collects the value as plain text input

#### Scenario: Sensitive value prompt
- **WHEN** a manifest declares a sensitive userConfig key
- **THEN** the engine displays the description and collects the value with input masked (no echo)

#### Scenario: No userConfig declared
- **WHEN** a manifest has no `userConfig` field
- **THEN** the engine proceeds directly to file installation with no prompts

#### Scenario: TUI prompt rendered as Ink component
- **WHEN** the user is in TUI mode and userConfig collection is triggered
- **THEN** each prompt is rendered as an inline Ink input component within the install view

#### Scenario: Headless prompt via readline
- **WHEN** the user is in headless CLI mode and userConfig collection is triggered
- **THEN** each prompt is printed to stdout and the value is read from stdin

### Requirement: Store collected values securely
The system SHALL store sensitive userConfig values in the OS keychain via `keytar`, falling back to `~/.config/ai-stash/credentials.json` (mode `0600`) when the keychain is unavailable. Non-sensitive values SHALL be stored in `~/.config/ai-stash/settings.json`.

#### Scenario: Sensitive value stored in keychain
- **WHEN** a sensitive userConfig value is collected and the OS keychain is available
- **THEN** the value is written to the keychain under the service name `ai-stash` with key `{assetName}/{configKey}`

#### Scenario: Sensitive value stored in credentials file when keychain unavailable
- **WHEN** a sensitive userConfig value is collected and the OS keychain is not available
- **THEN** the value is written to `~/.config/ai-stash/credentials.json` with file permissions `0600`, and the user is informed which storage is being used

#### Scenario: Non-sensitive value stored in settings file
- **WHEN** a non-sensitive userConfig value is collected
- **THEN** the value is written to `~/.config/ai-stash/settings.json` under `userConfig.{assetName}.{configKey}`

### Requirement: Substitute non-sensitive values into asset files
The system SHALL replace `${user_config.<key>}` placeholders in installed files with the collected non-sensitive value for `<key>`. Sensitive values SHALL NOT be substituted into any file by the engine.

#### Scenario: Non-sensitive substitution in file content
- **WHEN** an installed file contains `${user_config.endpoint}` and `endpoint` is a non-sensitive config key
- **THEN** the engine replaces the placeholder with the collected value before writing the file

#### Scenario: Sensitive placeholder left as-is
- **WHEN** an installed file contains `${user_config.api_key}` and `api_key` is a sensitive config key
- **THEN** the engine writes the literal string `${user_config.api_key}` into the file — the target runtime resolves it

#### Scenario: Placeholder for unknown key left as-is
- **WHEN** an installed file contains `${user_config.unknown}` and `unknown` is not declared in userConfig
- **THEN** the engine writes the literal placeholder without error

### Requirement: Expose userConfig values as environment variables
The system SHALL document that sensitive userConfig values are available to the user's Node.js setup script and to the target runtime as environment variables named `CLAUDE_STASH_CONFIG_<KEY>` (uppercased key).

#### Scenario: Env var available to setup script
- **WHEN** the asset has a `postInstall` script and a sensitive userConfig key `api_key`
- **THEN** the engine's notice to the user includes that `CLAUDE_STASH_CONFIG_api_key` will be set from the stored credential when the script is run

### Requirement: Flag reconfiguration needed on update
After updating a folder-based asset that has `userConfig`, the system SHALL set `reconfigurationNeeded: true` on the lockfile entry, unless the manifest declares `"configStable": true`. The TUI and headless status output SHALL surface assets in this state as "reconfiguration needed".

#### Scenario: Update flags reconfiguration needed by default
- **WHEN** a folder-based asset with `userConfig` is updated and the manifest does not declare `configStable: true`
- **THEN** the engine completes the update and sets `reconfigurationNeeded: true` in the lockfile entry

#### Scenario: configStable skips reconfiguration flag
- **WHEN** a folder-based asset is updated and the manifest declares `"configStable": true`
- **THEN** the engine completes the update without setting `reconfigurationNeeded` and existing stored config values are carried over silently

#### Scenario: Reconfiguration needed shown in status
- **WHEN** `ai-stash status` is run and a lockfile entry has `reconfigurationNeeded: true`
- **THEN** the asset is shown with a "reconfiguration needed" indicator

#### Scenario: Re-running install clears reconfiguration flag
- **WHEN** the user re-installs or reconfigures an asset with `reconfigurationNeeded: true`
- **THEN** userConfig is re-collected, stored values are updated, and `reconfigurationNeeded` is cleared from the lockfile
