# Spec: Script Risk Disclosure

## ADDED Requirements

### Requirement: Generic CLI risk list shown before any author documentation

The system SHALL always display a CLI-native generic risk list as the first section of the disclaimer screen, before any author-supplied `SCRIPT_RISKS.md` content. The generic list covers: filesystem changes, network access, process execution, shell/environment modification, and persistence mechanisms.

#### Scenario: Generic risk list appears first regardless of author docs

- **WHEN** the disclaimer screen is shown for any scripted asset, whether or not `SCRIPT_RISKS.md` is available
- **THEN** the generic risk list is the first content the developer sees, followed by author documentation if present

#### Scenario: Generic risk list is complete and not truncated

- **WHEN** the disclaimer is displayed
- **THEN** all five risk categories are listed: filesystem changes, network access, process execution, shell/environment modification, and persistence mechanisms

### Requirement: Risk disclaimer before installing scripted assets

The system SHALL present a risk disclaimer screen to the developer before installing any asset whose manifest declares `scripts.postInstall` or `scripts.postUninstall`. The developer MUST explicitly accept before installation proceeds.

#### Scenario: Disclaimer shown in TUI for asset with postInstall

- **WHEN** the developer initiates install of an asset and the manifest declares `scripts.postInstall`
- **THEN** the TUI shows a risk disclaimer screen with: (1) the generic CLI risk list, (2) any author-provided `SCRIPT_RISKS.md` content, (3) the script names declared — before showing the install confirmation

#### Scenario: Disclaimer shown in TUI for asset with postUninstall only

- **WHEN** the developer initiates install of an asset and the manifest declares `scripts.postUninstall` but no `scripts.postInstall`
- **THEN** the TUI still shows the risk disclaimer screen

#### Scenario: Developer accepts disclaimer

- **WHEN** the developer selects "Accept & Install" on the disclaimer screen
- **THEN** installation proceeds normally

#### Scenario: Developer cancels on disclaimer screen

- **WHEN** the developer selects "Cancel" on the disclaimer screen
- **THEN** installation is aborted and the developer is returned to the browse view

#### Scenario: No disclaimer for assets without scripts

- **WHEN** the developer installs an asset whose manifest declares no `scripts` fields
- **THEN** no disclaimer screen is shown and installation proceeds directly

#### Scenario: Disclaimer shown in headless mode

- **WHEN** `ai-stash add <name>` is run and the asset has scripts
- **THEN** the CLI prints the generic risk list first, then any author documentation, then prompts `Accept risks and install? [y/N]:`

#### Scenario: Headless install aborted if user declines

- **WHEN** the user types `n` or presses Enter at the headless disclaimer prompt
- **THEN** the install is aborted with exit code 1 and a message indicating the risk was not accepted

#### Scenario: Headless install proceeds if user accepts

- **WHEN** the user types `y` at the headless disclaimer prompt
- **THEN** installation proceeds

#### Scenario: --accept-script-risks flag bypasses headless prompt

- **WHEN** `ai-stash add <name> --accept-script-risks` is used and the asset has scripts
- **THEN** the risk text (generic list + author docs if available) is printed but no interactive prompt is shown and installation proceeds

#### Scenario: update --all halts before executing when a script change is detected

- **WHEN** `ai-stash update --all` is run and an asset with a changed script is detected during planning
- **THEN** the CLI halts the batch without executing any installs, outputs a message naming the blocking asset and the individual command to re-run it, and exits with code 1. Assets not yet updated are not modified

### Requirement: Author risk documentation surfaced in disclaimer

The system SHALL fetch and display the contents of the file referenced by `manifest.scriptRisks` within the risk disclaimer screen, labelled as author-provided documentation, after the generic risk list.

#### Scenario: Author SCRIPT_RISKS.md shown after generic list

- **WHEN** the disclaimer screen is shown and `manifest.scriptRisks` points to a fetchable file
- **THEN** the disclaimer shows (1) the generic risk list, then (2) a section "Author's Risk Documentation" with the file contents

#### Scenario: Graceful fallback when SCRIPT_RISKS.md is unavailable

- **WHEN** the disclaimer screen is shown but the file referenced by `manifest.scriptRisks` cannot be fetched
- **THEN** the disclaimer shows the generic risk list with a note: "Author risk documentation unavailable"

#### Scenario: No author section when scriptRisks not declared

- **WHEN** the disclaimer screen is shown and the manifest does not declare `scriptRisks`
- **THEN** only the generic risk list is shown, with no author documentation section

### Requirement: Risk acceptance recorded in lockfile

The system SHALL record `riskAccepted: true` and `riskAcceptedAt` (ISO 8601 timestamp) on the `InstalledAsset` lockfile entry when the developer accepts the disclaimer.

#### Scenario: Lockfile updated after acceptance

- **WHEN** the developer accepts the risk disclaimer and installation completes
- **THEN** the lockfile entry for the asset has `riskAccepted: true` and `riskAcceptedAt` set to the acceptance time

#### Scenario: Disclaimer re-shown when riskAccepted is absent

- **WHEN** an asset is being re-installed or updated and the lockfile entry has no `riskAccepted` field
- **THEN** the disclaimer is shown again as though installing for the first time

### Requirement: Removal warning when postUninstall is missing

The system SHALL warn the developer when removing an asset that was installed with scripts but has no `postUninstall` declared, and require confirmation before proceeding.

#### Scenario: Warning shown on removal with missing postUninstall

- **WHEN** `ai-stash remove <name>` is run and the installed asset has `riskAccepted: true` in the lockfile but `scriptHashes.postUninstall` is absent
- **THEN** the CLI prints a warning that script side effects may not be cleaned up and prompts `Continue with removal? [y/N]:`

#### Scenario: Removal aborted if user declines warning

- **WHEN** the user declines the removal confirmation
- **THEN** the asset is not removed and exit code 1 is returned

#### Scenario: --force bypasses removal warning prompt

- **WHEN** `ai-stash remove <name> --force` is used and the incomplete-cleanup warning applies
- **THEN** the warning text is still printed but no interactive prompt is shown and removal proceeds

#### Scenario: No warning when both scripts are present

- **WHEN** removing an asset that has both `scriptHashes.postInstall` and `scriptHashes.postUninstall` in the lockfile
- **THEN** no incomplete-cleanup warning is shown (the existing postUninstall notice is shown as before)

#### Scenario: No warning for assets without scripts

- **WHEN** removing an asset with no `riskAccepted` in the lockfile
- **THEN** no incomplete-cleanup warning is shown
