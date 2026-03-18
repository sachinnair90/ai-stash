### Requirement: Banner content
The banner SHALL display the `ai-stash` ASCII logo, the current tool version (from `package.json`), and the one-line tool description.

#### Scenario: Banner renders logo and version
- **WHEN** the banner is displayed
- **THEN** it shows the `ai-stash` ASCII art logo, the version string (e.g. `v0.1.0`), and the description `CLI tool for managing AI assistant assets`

### Requirement: Typewriter animation
The banner SHALL animate the description text using a character-reveal (typewriter) effect over approximately 800ms.

#### Scenario: Text reveals progressively
- **WHEN** the banner mounts
- **THEN** the description text appears one character at a time until fully revealed over ~800ms, then the full banner remains visible for ~500ms before transitioning

### Requirement: Automatic transition to main TUI
The banner SHALL automatically unmount and hand off to the main `App` TUI after the animation completes (~1300ms total), without requiring user input.

#### Scenario: Banner completes and transitions
- **WHEN** the banner animation finishes
- **THEN** the banner unmounts and the main TUI renders in its place

### Requirement: Non-interactive skip
The banner SHALL NOT render when stdout is not a TTY (e.g. CI environments, piped output).

#### Scenario: Non-TTY context
- **WHEN** `process.stdout.isTTY` is falsy
- **THEN** the banner is skipped and the main App renders immediately
