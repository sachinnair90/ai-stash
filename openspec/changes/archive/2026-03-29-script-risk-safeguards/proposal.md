# Proposal: Script Risk Safeguards

## Why

Assets that declare `scripts.postInstall` or `scripts.postUninstall` in their manifest can execute arbitrary code with the developer's user permissions when run — yet currently ai-stash installs them with no more ceremony than a skill or instruction. Developers have no visible warning before install, no signal that a script changed during an update, and no information about what a plugin's setup script actually does or leaves behind.

## What Changes

- **Script hash tracking**: On install, hash `postInstall`/`postUninstall` script contents and store in lockfile. On update, detect when scripts change and require re-review before proceeding.
- **Risk disclaimer gate**: Any asset with scripts triggers a mandatory risk disclaimer that the developer must explicitly accept before installation proceeds — in both TUI and headless CLI modes.
- **CLI-native generic disclaimer**: The CLI ships a built-in risk list (filesystem changes, network access, process execution, shell modification, persistence) shown to the developer before any author-supplied documentation, guaranteeing a minimum warning surface regardless of author diligence.
- **Author risk documentation (`SCRIPT_RISKS.md`)**: Authors declare what their scripts do, install, and how to manually undo everything. This file is fetched on-demand and displayed after the generic disclaimer.
- **Browse badge**: Assets with scripts are visibly flagged in the browse/search UI and headless list output.
- **Removal warning for incomplete cleanup**: When removing an asset that has `postInstall` but no `postUninstall`, warn the developer that script side effects cannot be cleaned up automatically.
- **Registry README risk model documentation**: Explicit documentation of what ai-stash does and does not guarantee about scripts.
- **Add-asset skill enforcement**: The skill requires `SCRIPT_RISKS.md` and a `postUninstall` (or documented justification for its absence) whenever scripts are declared, enabling registries to enforce author diligence as a condition of listing.

## Capabilities

### New Capabilities

- `script-risk-disclosure`: Risk disclaimer flow — per-asset acceptance gate (TUI + headless), risk text content, `--accept-script-risks` headless flag, acceptance state in lockfile.
- `script-change-detection`: Hash scripts at install time, detect changes on update, trigger re-review when changed.

### Modified Capabilities

- `asset-install-scripts`: Add `scriptRisks` field to `AssetManifest` (path to `SCRIPT_RISKS.md`). Add `hasScripts` field to `RegistryAsset` (registry-build-time flag). Surface `SCRIPT_RISKS.md` content in the disclaimer screen.
- `asset-manifest`: Add `scriptHashes` and `riskAccepted`/`riskAcceptedAt` to `InstalledAsset` lockfile type.
- `asset-browsing`: Show "has setup script" badge in browse and list views when `hasScripts: true`.

## Impact

- `src/registry/types.ts` — `AssetManifest` (new `scriptRisks` field), `RegistryAsset` (new `hasScripts` field)
- `src/lockfile/types.ts` — `InstalledAsset` (new `scriptHashes`, `riskAccepted`, `riskAcceptedAt`)
- `src/engine/install.ts` — hash scripts, disclaimer gate, acceptance storage
- `src/engine/update.ts` — detect script hash changes, re-trigger disclaimer
- `src/engine/types.ts` — `InstallPlan` (carry script risk content), `InstallResult`
- `src/commands/add.ts` — headless disclaimer flow, `--accept-script-risks` flag
- `src/commands/remove.ts` — warn when `postInstall` present but no `postUninstall`
- `src/commands/list.ts` — badge in headless list output
- `src/ui/views/` — disclaimer component, badge in browse/install views
- `registry/plugins/dev-workflow/manifest.json` — add `scriptRisks`
- `bundled/skills/add-asset/SKILL.md` — require `SCRIPT_RISKS.md` + postUninstall when scripts declared
- `registry/README.md` — risk model documentation
