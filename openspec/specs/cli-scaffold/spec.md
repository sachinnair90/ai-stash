### Requirement: npm package with bin entry
The package SHALL be a valid npm package with a `bin` field pointing to the CLI entry point, runnable via `npx ai-stash`.

#### Scenario: npx execution
- **WHEN** a user runs `npx ai-stash`
- **THEN** the TUI launches without requiring any prior global installation

#### Scenario: Direct execution after install
- **WHEN** a user runs `npm install -g ai-stash` and then `ai-stash`
- **THEN** the TUI launches from the global install

### Requirement: Node.js version check
The system SHALL require Node.js ≥18 and display a clear error if the runtime version is insufficient.

#### Scenario: Supported Node version
- **WHEN** the user runs ai-stash on Node.js 18+
- **THEN** the tool starts normally

#### Scenario: Unsupported Node version
- **WHEN** the user runs ai-stash on Node.js <18
- **THEN** the tool displays an error message stating the minimum required version and exits

### Requirement: Configuration file
The system SHALL read configuration from `~/.config/ai-stash/config.json`, creating it with defaults on first run.

#### Scenario: First run
- **WHEN** no config file exists
- **THEN** the system creates `~/.config/ai-stash/config.json` with default values (official registry URL, default TTL of 3600, default target "claude-code")

#### Scenario: Existing config
- **WHEN** a config file exists
- **THEN** the system reads and validates it, using defaults for any missing fields

### Requirement: Configuration schema
The config file SHALL support: `registry` (object with name and url), `cacheTTL` (number in seconds), and `defaultTarget` (string).

#### Scenario: Valid config
- **WHEN** the config file contains valid fields
- **THEN** the system uses those values for registry URL, cache TTL, and default target tool

#### Scenario: Invalid config
- **WHEN** the config file contains invalid JSON or unknown fields
- **THEN** the system warns the user and falls back to defaults for invalid fields

### Requirement: Cross-platform paths
The system SHALL resolve all file paths using platform-appropriate separators and home directory detection, working on macOS, Linux, and Windows (WSL).

#### Scenario: Home directory resolution
- **WHEN** the system needs to write to `~/.config/ai-stash/`
- **THEN** it resolves `~` using the platform's home directory (process.env.HOME or os.homedir())

#### Scenario: Project directory detection
- **WHEN** the system needs to write project-scope files
- **THEN** it uses the current working directory as the project root

### Requirement: Minimal dependencies
The package SHALL minimize dependencies to keep install time fast for the npx use case.

#### Scenario: Cold npx start
- **WHEN** a user runs `npx ai-stash` for the first time
- **THEN** the package downloads and installs in a reasonable time (target: under 10 seconds on typical connection)
