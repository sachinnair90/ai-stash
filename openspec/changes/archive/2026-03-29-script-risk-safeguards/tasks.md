# Tasks: Script Risk Safeguards

## 1. Type System Updates

- [x] 1.1 Add `scriptHashes?: { postInstall?: string; postUninstall?: string }` to `InstalledAsset` in `src/lockfile/types.ts`
- [x] 1.2 Add `riskAccepted?: boolean` and `riskAcceptedAt?: string` to `InstalledAsset` in `src/lockfile/types.ts`
- [x] 1.3 Add `scriptRisks?: string` to `AssetManifest` in `src/registry/types.ts`
- [x] 1.4 Add `hasScripts?: boolean` to `RegistryAsset` in `src/registry/types.ts`
- [x] 1.5 Add `scriptRisksContent?: string` and `scriptHashesForPlan?: Record<string, string>` to `InstallPlan` in `src/engine/types.ts`
- [x] 1.6 Add `riskAccepted?: boolean` and `riskAcceptedAt?: string` to the `executeInstall` options object in `src/engine/install.ts` (the `{ skipConfiguredFiles?: boolean }` param); when provided, write these onto the created `InstalledAsset` lockfile entry

## 2. Registry Fetcher — Script Content Fetching

- [x] 2.1 Add `fetchScriptRisks(baseUrl, scriptRisksPath, token?)` function to `src/registry/fetcher.ts` that fetches the file and returns its text content, returning `null` on network failure
- [x] 2.2 In `planInstall()` (`src/engine/install.ts`), after fetching the manifest, if `manifest.scriptRisks` is set, call `fetchScriptRisks` and attach content to the plan

## 3. Script Hashing

- [x] 3.1 Add `hashScriptContent(content: string): string` utility in `src/engine/install.ts` using `crypto.createHash('sha256')`
- [x] 3.2 In `planInstall()`, read the raw content of `manifest.scripts.postInstall` and `manifest.scripts.postUninstall` from the already-fetched `rawFiles` map (keyed by the script filename) — do NOT make additional network fetches. Compute their sha256 hashes and attach to the plan via `scriptHashesForPlan`
- [x] 3.3 In `executeInstall()`, when `scriptHashesForPlan` is present on the plan, write the computed hashes into `lockfileEntry.scriptHashes`

## 4. Script Change Detection in Update Engine

- [x] 4.1 In `src/engine/update.ts` (`updateAssetFull`), after fetching the new manifest, compare incoming script hashes (from the plan's `scriptHashesForPlan`) against `lockfile.installed[key].scriptHashes`
- [x] 4.2 If any hash differs (or a script was added/removed), set a `scriptChanged: boolean` flag and pass it through to the install plan
- [x] 4.3 If `scriptChanged`, delete the `.setup-complete` marker file from the installed asset folder **after** `executeInstall` has written all updated files — use the plan's manifest (not the on-disk manifest) to determine whether a script is present, to avoid a race between marker deletion and the manifest file write
- [x] 4.4 Reset `riskAccepted` and `riskAcceptedAt` on the lockfile entry when `scriptChanged` is true

## 5. Risk Disclaimer — Headless CLI

- [x] 5.1 Refactor `handleAddCommand` in `src/commands/add.ts` to call `planInstall` → disclaimer gate → `executeInstall` directly, rather than delegating to `installAssetFull`. `installAssetFull` remains available for callers that do not need a disclaimer gate (e.g. sync)
- [x] 5.2 After `planInstall`, check if the plan's manifest declares `scripts`. If so, build and print the full disclaimer: (a) CLI-native generic risk section (see task 5.8), then (b) author `scriptRisksContent` section labelled "Author's Risk Documentation" if present, or a note "Author risk documentation unavailable" if `manifest.scriptRisks` was declared but the fetch returned null, then (c) script names declared, then (d) a missing-postUninstall warning if applicable
- [x] 5.3 Print disclaimer and prompt `Accept risks and install? [y/N]:` using readline
- [x] 5.4 Abort with exit code 1 if user declines (or hits Enter without 'y')
- [x] 5.5 Add `--accept-script-risks` flag to the `add` command that prints the disclaimer text but skips the interactive prompt
- [x] 5.6 Pass `riskAccepted: true` and `riskAcceptedAt` into `executeInstall` options when the developer accepts (or `--accept-script-risks` is used)
- [x] 5.7 In `src/commands/update.ts` headless path (`updateOne`), apply the same disclaimer flow when `scriptChanged` is true (with banner "Script changed since last install — please re-review"). For `updateAll`, if a scripted-change asset is encountered: print the disclaimer, halt the batch with a message naming the blocking asset and the command to re-run it individually, and exit with code 1
- [x] 5.8 Add a `GENERIC_SCRIPT_RISKS` constant (e.g. in `src/engine/script-risks.ts`) containing the CLI-native baseline risk list:
  - **Filesystem changes**: may create, modify, or delete files outside the asset directory
  - **Network access**: may make outbound network requests during setup
  - **Process execution**: may spawn child processes or background daemons
  - **Shell/environment modification**: may alter PATH, shell rc files, or environment variables
  - **Persistence mechanisms**: may install launch agents, cron jobs, or systemd units

## 6. Risk Disclaimer — TUI Component

- [x] 6.1 Create `src/ui/components/ScriptRiskDisclaimer.tsx` Ink component that renders the full disclaimer screen: CLI-native generic risk section first (from `GENERIC_SCRIPT_RISKS`), then author docs section, then accept/cancel controls
- [x] 6.2 Accept props: `assetName`, `scripts` (declared script names), `scriptRisksContent?: string`, `scriptChanged?: boolean`, `onAccept`, `onCancel`
- [x] 6.3 In the TUI install flow (`src/ui/views/InstallView.tsx` or equivalent), check `plan.manifest?.scripts` and gate on disclaimer acceptance before calling `executeInstall`
- [x] 6.4 Pass `riskAccepted: true` and `riskAcceptedAt` into `executeInstall` options when developer accepts in TUI
- [x] 6.5 In the TUI update flow, wire the same `ScriptRiskDisclaimer` when `scriptChanged` is true with the "re-review" banner
- [x] 6.6 Update the `installAsset` TUI-compat wrapper in `src/engine/install.ts` to accept `riskAccepted?: boolean` and `riskAcceptedAt?: string` in its options and forward them to `executeInstall`. `InstallView.tsx` is responsible for showing the disclaimer before calling `installAsset`; the wrapper itself does not gate

## 7. Browse Badge

- [x] 7.1 In the TUI browse list renderer, check `asset.hasScripts` and render a "⚙ script" badge when true
- [x] 7.2 In `src/commands/list.ts` headless output, check `installedEntry.scriptHashes` presence and append a "has scripts" annotation to the asset row

## 8. Removal Warning

- [x] 8.1 In `src/commands/remove.ts`, after loading the lockfile entry, check if `riskAccepted === true` and `scriptHashes?.postUninstall` is absent
- [x] 8.2 If so, print the incomplete-cleanup warning text and prompt `Continue with removal? [y/N]:`
- [x] 8.3 Abort with exit code 1 if user declines
- [x] 8.4 Add `--force` flag to `remove` command to bypass the interactive prompt (still print warning text)

## 9. Sync — Preserve Risk Acceptance State

- [x] 9.1 In `syncFromLockfile` (`src/engine/install.ts`), before calling `executeInstall` for each asset, read `riskAccepted` and `riskAcceptedAt` from the existing lockfile entry and pass them into the `executeInstall` options (task 1.6). This preserves prior acceptance state and prevents the next install/update cycle from treating the asset as unreviewed

## 10. Registry Data — dev-workflow Plugin

- [x] 10.1 Add `"hasScripts": true` to the `dev-workflow` entry in `registry/registry.json`
- [x] 10.2 Create `registry/plugins/dev-workflow/SCRIPT_RISKS.md` with documented risks and manual uninstall steps
- [x] 10.3 Add `"scriptRisks": "plugins/dev-workflow/SCRIPT_RISKS.md"` to `registry/plugins/dev-workflow/manifest.json`

## 11. Registry README Risk Model

- [x] 11.1 Add a "## Script Risk Model" section to `registry/README.md` documenting what ai-stash does/does not guarantee, the trust chain, and the author obligations for scripted assets

## 12. Add-Asset Skill Updates

- [x] 12.1 In `bundled/skills/add-asset/SKILL.md`, add a validation step: when the author declares any `scripts` field, the skill MUST prompt for `SCRIPT_RISKS.md` content before completing
- [x] 12.2 Add skill guidance: if `scripts.postInstall` is declared without `scripts.postUninstall`, require the author to add a "No cleanup script" section to `SCRIPT_RISKS.md` describing what the developer must manually undo
- [x] 12.3 Add skill output step: generate `SCRIPT_RISKS.md` as a file alongside the manifest, and set `"scriptRisks"` in `manifest.json` pointing to it
- [x] 12.4 Add skill note: remind authors to set `hasScripts: true` in their `registry.json` entry when scripts are declared

## 13. Tests

- [x] 13.1 Add tests to `src/__tests__/asset-lifecycle.test.ts`: script hash stored on install from `rawFiles` (no extra fetch), hash change detected on update, `.setup-complete` reset after file writes on script change
- [x] 13.2 Add tests: risk disclaimer shown in headless `add` when scripts present; `--accept-script-risks` bypasses prompt; install aborted when user declines
- [x] 13.3 Add tests: removal warning when `riskAccepted` and no `postUninstall` hash; `--force` bypasses prompt
- [x] 13.4 Add tests: `fetchScriptRisks` returns null on failure and disclaimer handles gracefully (falls back to generic-only)
- [x] 13.5 Update `src/__tests__/headless-list.test.ts`: verify "has scripts" annotation appears for asset with `scriptHashes` in lockfile
- [x] 13.6 Add tests: `syncFromLockfile` preserves `riskAccepted`/`riskAcceptedAt` from existing lockfile entry after reinstall
- [x] 13.7 Add tests: `update --all` halts and exits 1 when a scripted-change asset is encountered; message names the blocking asset
- [x] 13.8 Add tests: generic risk list (`GENERIC_SCRIPT_RISKS`) appears in disclaimer output before any author content
