## ADDED Requirements

### Requirement: Post-install script verifies Squad at pinned version
The script SHALL check the installed Squad CLI version against the pinned version (`0.9.x`) and install the pinned version if missing or mismatched.

#### Scenario: Squad missing — installs pinned version
- **WHEN** the post-install script runs and `squad --version` fails or returns a non-matching version
- **THEN** the script installs Squad at the pinned version via npm
- **THEN** the script prints a success message confirming the installed version

#### Scenario: Squad at correct version — skips install
- **WHEN** the post-install script runs and Squad is already at the pinned version
- **THEN** the script skips the install step and prints a confirmation

### Requirement: Post-install script verifies OpenSpec at pinned version
The script SHALL check the installed OpenSpec CLI version against the pinned version (`1.2.x`) and install the pinned version if missing or mismatched.

#### Scenario: OpenSpec missing — installs pinned version
- **WHEN** the post-install script runs and `openspec --version` fails or returns a non-matching version
- **THEN** the script installs OpenSpec at the pinned version via npm
- **THEN** the script prints a success message confirming the installed version

### Requirement: Post-install script inits .squad/ if absent
If `.squad/` does not exist, the script SHALL run `squad init` to scaffold the directory structure before applying patches.

#### Scenario: Fresh repo — Squad inits before patching
- **WHEN** the post-install script runs and `.squad/` does not exist
- **THEN** `squad init` is run to create the Squad directory structure
- **THEN** patching proceeds after init completes

### Requirement: Post-install script inits openspec/ if absent
If `openspec/` does not exist, the script SHALL run `openspec init` to scaffold the directory structure.

#### Scenario: Fresh repo — OpenSpec inits
- **WHEN** the post-install script runs and `openspec/` does not exist
- **THEN** `openspec init` is run to create the OpenSpec directory structure

### Requirement: Post-install script applies ceremony and routing patches idempotently
The script SHALL append the spec-gate ceremony definition and Speccer routing entry to their respective Squad files only if they are not already present.

#### Scenario: First install — patches are applied
- **WHEN** the post-install script runs and `.squad/ceremonies.md` does not contain the `specship:spec-gate` sentinel
- **THEN** the spec-gate ceremony definition is appended to `.squad/ceremonies.md`
- **WHEN** `.squad/routing.md` does not contain the `specship:speccer` sentinel
- **THEN** the Speccer routing entry is appended to `.squad/routing.md`

#### Scenario: Re-run — patches are skipped
- **WHEN** the post-install script runs and the sentinels are already present in the Squad files
- **THEN** no changes are made to `.squad/ceremonies.md` or `.squad/routing.md`
- **THEN** the script reports "already applied — skipping"

### Requirement: Post-install script writes .setup-complete on success
On successful completion of all steps, the script SHALL write a `.setup-complete` file in the plugin's installed directory so ai-stash can track setup status.

#### Scenario: Setup completes successfully
- **WHEN** all verification, init, and patch steps succeed
- **THEN** `.setup-complete` is written to the plugin directory
- **THEN** the script exits with code 0 and prints a summary of what was done

#### Scenario: Setup fails — .setup-complete is not written
- **WHEN** any step fails (e.g., npm install error, Squad init fails)
- **THEN** the script exits with a non-zero code
- **THEN** `.setup-complete` is NOT written
- **THEN** the error is printed with instructions for manual resolution
