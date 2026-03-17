## MODIFIED Requirements

### Requirement: npm package with bin entry
The package SHALL be a valid npm package with a `bin` field pointing to the CLI entry point, runnable via `npx ai-stash`. On launch the entry point SHALL render the startup banner before mounting the main TUI (unless stdout is not a TTY).

#### Scenario: npx execution
- **WHEN** a user runs `npx ai-stash`
- **THEN** the startup banner animates briefly, then the main TUI launches without requiring any prior global installation

#### Scenario: Direct execution after install
- **WHEN** a user runs `npm install -g ai-stash` and then `ai-stash`
- **THEN** the startup banner animates briefly, then the TUI launches from the global install

#### Scenario: Non-interactive execution
- **WHEN** a user runs `ai-stash` in a non-TTY context (e.g. piped or CI)
- **THEN** the banner is skipped and the TUI renders immediately
