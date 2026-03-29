# Spec: Asset Manifest

## ADDED Requirements

### Requirement: scriptHashes in InstalledAsset lockfile type

The `InstalledAsset` type SHALL support an optional `scriptHashes` field containing sha256 hex digests of installed script contents keyed by script role (`postInstall`, `postUninstall`).

#### Scenario: scriptHashes present for scripted asset

- **WHEN** a scripted asset is written to the lockfile
- **THEN** the lockfile entry has a `scriptHashes` object with keys for each declared script

#### Scenario: scriptHashes absent for non-scripted asset

- **WHEN** a non-scripted asset is written to the lockfile
- **THEN** the lockfile entry has no `scriptHashes` field

### Requirement: riskAccepted and riskAcceptedAt in InstalledAsset lockfile type

The `InstalledAsset` type SHALL support optional `riskAccepted: boolean` and `riskAcceptedAt: string` (ISO 8601) fields to track developer acknowledgment of script risks.

#### Scenario: riskAccepted set after disclaimer acceptance

- **WHEN** the developer accepts the risk disclaimer and the asset is installed
- **THEN** the lockfile entry has `riskAccepted: true` and `riskAcceptedAt` set to the current ISO timestamp

#### Scenario: riskAccepted absent for non-scripted asset

- **WHEN** an asset with no scripts is installed
- **THEN** the lockfile entry has no `riskAccepted` or `riskAcceptedAt` fields

#### Scenario: Existing lockfile entries without riskAccepted are valid

- **WHEN** the lockfile contains entries from a previous version of ai-stash that lack `riskAccepted`
- **THEN** the engine treats these as not-yet-reviewed and shows the disclaimer on the next install or update of that asset

### Requirement: riskAccepted preserved by syncFromLockfile

The system SHALL preserve existing `riskAccepted` and `riskAcceptedAt` values when reinstalling an asset via `syncFromLockfile`. Sync does not prompt the developer again — the prior acceptance is carried forward onto the new lockfile entry.

#### Scenario: Sync preserves prior risk acceptance

- **WHEN** `ai-stash sync` reinstalls a scripted asset that has `riskAccepted: true` in the lockfile
- **THEN** the reinstalled lockfile entry retains `riskAccepted: true` and the original `riskAcceptedAt` timestamp

#### Scenario: Sync with no prior acceptance does not prompt

- **WHEN** `ai-stash sync` reinstalls a scripted asset that has no `riskAccepted` in the lockfile
- **THEN** no disclaimer is shown during sync; the lockfile entry is written without `riskAccepted`, and the disclaimer will appear on the next explicit install or update
