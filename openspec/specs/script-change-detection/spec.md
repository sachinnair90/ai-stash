# Spec: Script Change Detection

## ADDED Requirements

### Requirement: Hash postInstall and postUninstall scripts at install time

The system SHALL compute a sha256 hash of the raw text content of any declared `postInstall` and `postUninstall` scripts at install time and store the hashes in the lockfile entry under `scriptHashes`. Script content is read from the already-fetched `rawFiles` map — no additional network fetch is made.

#### Scenario: Hash stored after install with postInstall

- **WHEN** an asset with `scripts.postInstall` is installed
- **THEN** the lockfile entry for that asset contains `scriptHashes.postInstall` with the sha256 hex digest of the fetched script content

#### Scenario: Hash stored for both scripts when both declared

- **WHEN** an asset declares both `scripts.postInstall` and `scripts.postUninstall`
- **THEN** the lockfile entry contains both `scriptHashes.postInstall` and `scriptHashes.postUninstall`

#### Scenario: No scriptHashes field when no scripts declared

- **WHEN** an asset with no `scripts` fields is installed
- **THEN** the lockfile entry has no `scriptHashes` field

### Requirement: Detect script changes on update

The system SHALL compare the hash of each script in the incoming manifest against the stored hash in the lockfile. When any hash differs, the system SHALL treat the script as changed.

#### Scenario: Script change detected on update

- **WHEN** `ai-stash update <name>` is run and the fetched `postInstall` script content produces a different sha256 than the stored `scriptHashes.postInstall`
- **THEN** the system flags the update as having a changed script

#### Scenario: No change detected when script content identical

- **WHEN** the fetched script hash matches the stored hash
- **THEN** no script-change flag is set and the update proceeds without re-review

#### Scenario: New script added in updated version

- **WHEN** the new version of an asset declares `scripts.postInstall` but the previously installed version did not
- **THEN** the system treats this as a script change (absent vs. present)

#### Scenario: Script removed in updated version

- **WHEN** the new version of an asset declares no `scripts.postInstall` but the previously installed version did
- **THEN** the system notifies the developer that the setup script was removed in this version

### Requirement: Re-trigger risk disclaimer when script changes on update

The system SHALL re-show the risk disclaimer and reset `riskAccepted` in the lockfile whenever a script change is detected during an update.

#### Scenario: Disclaimer re-shown on update with changed script (TUI)

- **WHEN** an update has a changed script and the developer proceeds in the TUI
- **THEN** the risk disclaimer screen is shown with a banner "Script changed since last install — please re-review", with the generic risk list first followed by any author documentation

#### Scenario: Disclaimer re-shown on update with changed script (headless)

- **WHEN** `ai-stash update <name>` detects a script change
- **THEN** the CLI prints the risk text with a header "Script changed since last install" and prompts acceptance

#### Scenario: riskAccepted reset when script changes

- **WHEN** the developer accepts the disclaimer during an update with changed scripts
- **THEN** `riskAccepted` is set to true and `riskAcceptedAt` is updated to the new acceptance time

### Requirement: .setup-complete marker reset after file writes complete when script changes

The system SHALL delete the `.setup-complete` marker file when a script change is detected on update. This deletion occurs after `executeInstall` has written all updated files, and uses the incoming manifest (carried on the plan) to determine script presence — not the on-disk manifest — to avoid a race between marker deletion and the manifest file write.

#### Scenario: .setup-complete marker reset when script changes

- **WHEN** a script change is detected during update and `executeInstall` completes successfully
- **THEN** the `.setup-complete` marker file in the installed asset folder is deleted so the asset returns to "setup pending" status

#### Scenario: .setup-complete deletion uses plan manifest not on-disk manifest

- **WHEN** determining whether to delete `.setup-complete` after an update
- **THEN** the engine uses `plan.manifest.scripts` (fetched from registry) rather than reading the manifest file from disk, to avoid stale reads during the file write window
