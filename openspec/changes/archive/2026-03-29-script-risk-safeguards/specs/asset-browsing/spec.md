# Spec: Asset Browsing

## ADDED Requirements

### Requirement: Display "has setup script" badge for scripted assets

The system SHALL display a visible badge or indicator on any asset in the browse list whose registry entry has `hasScripts: true`. The badge SHALL appear in both the TUI browse view and the headless `ai-stash list` output.

The TUI browse badge is driven by `asset.hasScripts` from registry data (available before install, no manifest fetch required). The headless `list` badge is driven by `installedEntry.scriptHashes` from lockfile data (available only for installed assets). This asymmetry is intentional: browse must work without per-asset manifest fetches; list can rely on the lockfile.

#### Scenario: Script badge in TUI browse view

- **WHEN** the browse view renders an asset with `hasScripts: true`
- **THEN** a "⚙ has setup script" label is shown alongside the asset's type badge

#### Scenario: Script label in headless list output

- **WHEN** `ai-stash list` is run and an installed asset has `scriptHashes` present in the lockfile
- **THEN** the asset row includes a "has scripts" annotation

#### Scenario: No badge for assets without scripts

- **WHEN** an asset has no `hasScripts` field or `hasScripts: false`
- **THEN** no script badge is shown for that asset in the browse view

#### Scenario: Installed asset without scriptHashes shows no annotation in list

- **WHEN** `ai-stash list` is run and an installed asset has no `scriptHashes` in its lockfile entry
- **THEN** no "has scripts" annotation is shown for that asset
