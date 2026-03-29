## 1. Registry Type Changes

- [x] 1.1 Add `file?: string` and `folder?: string` optional fields to `RegistryAsset` in `src/registry/types.ts`
- [x] 1.2 Add `hasManifest?: boolean` and `reconfigurationNeeded?: boolean` fields to `InstalledAsset` in `src/lockfile/types.ts`
- [x] 1.3 Define `AssetManifest` interface in `src/registry/types.ts` (fields: `files`, `userConfig`, `scripts`, `configuredFiles`, `configStable?: boolean`)
- [x] 1.4 Define `UserConfigEntry` interface (`description: string`, `sensitive: boolean`)

## 2. Manifest Fetcher

- [x] 2.1 Add `fetchManifest(baseUrl, folder, githubToken?)` function to `src/registry/fetcher.ts` that fetches `{folder}/manifest.json` and returns a parsed `AssetManifest`
- [x] 2.2 Update `planInstall` in `src/engine/install.ts` to detect `folder` field on asset and call `fetchManifest` before fetching content files
- [x] 2.3 Resolve full file list from manifest when asset uses `folder` field (use `manifest.files` instead of `asset.files`)
- [x] 2.4 Return fatal error from `planInstall` if `folder` is set but manifest fetch fails

## 3. Credential Storage Module

- [x] 3.1 Add `keytar` as a regular dependency in `package.json`
- [x] 3.2 Create `src/config/credentials.ts` with `storeCredential(assetName, key, value)` and `getCredential(assetName, key)` functions
- [x] 3.3 Implement keychain path: attempt `require('keytar')` inside a try/catch; on failure emit a one-time info message and fall back to credentials file
- [x] 3.4 Implement fallback path: write/read `~/.config/ai-stash/credentials.json` with `0600` permissions
- [x] 3.5 Create `src/config/user-settings.ts` with `storeUserConfig(assetName, key, value)` and `getUserConfig(assetName, key)` for non-sensitive values in `~/.config/ai-stash/settings.json`

## 4. userConfig Collection

- [x] 4.1 Create `src/engine/user-config.ts` with `collectUserConfig(assetName, userConfig, existingKeys)` that returns a map of `{key: value}` — prompts only for keys not already stored
- [x] 4.2 Implement headless (readline) collection path in `collectUserConfig` for CLI mode
- [x] 4.3 Create `UserConfigPrompt` Ink component in `src/ui/components/UserConfigPrompt.tsx` for TUI mode (masked input for sensitive values)
- [x] 4.4 Wire TUI mode: detect interactive context and use `UserConfigPrompt`; fall back to readline for headless
- [x] 4.5 Add `substituteUserConfig(content, nonSensitiveValues)` in `src/engine/user-config.ts` to replace `${user_config.<key>}` in file content (sensitive keys left as-is)

## 5. Install Engine Integration

- [x] 5.1 Update `planInstall` to call `collectUserConfig` when manifest has `userConfig`, before building the `transformedFiles` map
- [x] 5.2 Apply `substituteUserConfig` to each file's content after adapter transformation
- [x] 5.3 Update `executeInstall` to append `configuredFiles` entries to `.gitignore` (no duplicates) and auto-include `.setup-complete` when `scripts.postInstall` is declared
- [x] 5.4 Update `executeInstall` to exclude `configuredFiles` paths from the lockfile `files[]` entry
- [x] 5.5 Set `hasManifest: true` on the lockfile entry when installing a folder-based asset

## 6. postInstall / postUninstall Notices

- [x] 6.1 Add `buildScriptNotice(scriptPath, verb)` helper in `src/engine/install.ts` that returns a formatted notice string with the `node` invocation command
- [x] 6.2 Return the notice string from `executeInstall` (extend `InstallResult` with `scriptNotice?: string`)
- [x] 6.3 Render `scriptNotice` in TUI install view and print it in headless CLI output
- [x] 6.4 In `removeAssetFull` (`src/engine/update.ts`), read `manifest.json` from the installed folder before deleting files; if `scripts.postUninstall` is declared, store the notice to return after deletion
- [x] 6.5 Extend `RemoveResult` with `scriptNotice?: string` and populate it from step 6.4
- [x] 6.6 Render `scriptNotice` in TUI remove view and print it in headless CLI output after removal

## 7. Update Engine: configuredFiles Preservation and Reconfiguration Flag

- [x] 7.1 In `updateAssetFull` (`src/engine/update.ts`), fetch the new manifest and skip userConfig collection (values carry over or get re-prompted only when user explicitly reconfigures)
- [x] 7.2 In `executeInstall` (when called from update path), skip writing any file whose path matches `manifest.configuredFiles`
- [x] 7.3 After a successful update of a folder-based asset with `userConfig`, set `reconfigurationNeeded: true` on the lockfile entry unless the manifest declares `configStable: true`
- [x] 7.4 When the user re-installs or reconfigures an asset, re-collect all userConfig values and clear `reconfigurationNeeded` from the lockfile entry

## 8. Status Command: Setup Pending Indicator

- [x] 8.1 Add `checkSetupPending(projectRoot, lockfileKey, installedAsset)` in `src/engine/install.ts` that returns `true` if the asset has `hasManifest: true` and the installed folder lacks `.setup-complete`
- [x] 8.2 Expose setup-pending state in the installed assets view in the TUI
- [x] 8.3 Expose reconfiguration-needed state in the installed assets view in the TUI
- [x] 8.4 Include setup-pending and reconfiguration-needed assets in `ai-stash status` headless CLI output

## 9. Registry Migration

- [x] 9.1 Update `registry/registry.json`: replace `files[]` + `manifestUrl` with `folder` field for `hooks/post-edit-typecheck`
- [x] 9.2 Create `registry/hooks/post-edit-typecheck/manifest.json` with `files`, and (if applicable) `userConfig`, `scripts`, `configuredFiles`
- [x] 9.3 Update `registry/registry.json`: replace entry for `mcp-servers/github` with `folder` field
- [x] 9.4 Create `registry/mcp-servers/github/manifest.json`
- [x] 9.5 Update `registry/registry.json`: replace `files[]` for `plugins/dev-workflow` with `folder` field
- [x] 9.6 Create `registry/plugins/dev-workflow/manifest.json` listing all current plugin files

## 10. add-asset Skill — Full Overhaul

This section covers the complete rewrite of `.claude/skills/add-asset/SKILL.md`.
The goal: the skill acts as brainstormer → reviewer → generator → onboarder for asset authors,
reducing authoring load and producing correct, complete assets in one pass.

### 10a. Audit and remove stale content
- [x] 10.1 Remove stale `files[]` instructions for hooks, mcp-servers, and plugins (these now use `folder` + `manifest.json`)
- [x] 10.2 Remove the `run.sh` hook template with `#!/usr/bin/env bash` (hooks are now folder-based with manifest; scripts are Node.js only)
- [x] 10.3 Remove the flat `mcp.json` single-file pattern for mcp-servers (now folder-based)
- [x] 10.4 Remove the flat plugin `files[]` pattern; replace with folder-based guidance
- [x] 10.5 Update the registry.json entry template: use `file` field for simple types, `folder` field for hooks/mcp-servers/plugins; remove `manifestUrl` from folder-based entries

### 10b. Brainstormer mode — guided authoring questions
- [x] 10.6 Add an upfront "asset design interview" section: for hooks/mcp-servers/plugins, the skill asks a structured set of questions before generating anything:
  - Does this asset need any user-supplied configuration (API keys, endpoints, tokens)? → leads to `userConfig`
  - Does it need a setup step that can't be expressed declaratively (e.g. `npm install`, service registration)? → leads to `scripts.postInstall`
  - Will the setup step produce any output files containing user-specific values? → leads to `configuredFiles`
  - Should configuration be preserved as-is when the asset is updated (i.e. is config stable across versions)? → leads to `configStable`
- [x] 10.7 For each `userConfig` value collected in the interview, ask: is this sensitive (password/token) or non-sensitive (URL/username)? Explain the difference and its consequences (storage location, substitution availability)

### 10c. Safety reviewer — validate before generating
- [x] 10.8 After the interview, show a pre-generation summary and ask for confirmation before writing any files
- [x] 10.9 Warn (not block) if a declared script file is not `.js`/`.mjs`: explain cross-platform risk, suggest Node.js equivalent
- [x] 10.10 Warn if any userConfig value looks like a secret (name contains `key`, `token`, `secret`, `password`) but is not marked `sensitive: true`
- [x] 10.11 Warn if `scripts.postInstall` is declared but `configuredFiles` is empty: prompt author to consider whether the script produces any output files

### 10d. Generator — scaffold all files correctly
- [x] 10.12 For folder-based assets (hook/mcp-server/plugin), generate `manifest.json` as the first file, populated from interview answers
- [x] 10.13 Scaffold `setup.js` boilerplate when `scripts.postInstall` is declared: include `process.env.CLAUDE_STASH_CONFIG_<KEY>` access pattern for each sensitive userConfig key, and `fs.writeFileSync('.setup-complete', '')` as the final step
- [x] 10.14 Ensure `manifest.json` always includes `.setup-complete` in `configuredFiles` when `scripts.postInstall` is present (even if author did not mention it)
- [x] 10.15 For simple asset types (skill/agent/instruction/command), keep the existing single-file generation path unchanged — do not apply manifest overhead

### 10e. Onboarder — local test + PR submission
- [x] 10.16 Keep and update the local test instructions (serve registry, clear cache, run TUI) to reflect folder-based asset paths
- [x] 10.17 After generation and verification, offer PR submission help: "Would you like help creating a PR to the target registry?" — if yes, ask the developer to provide either the PR template content or a file path to the template in the target registry
- [x] 10.18 If a PR template is provided, scaffold a `gh pr create` command pre-filled with the asset name, type, description, and template body; guide the developer to review before submitting
- [x] 10.19 If no template is provided, offer a sensible default PR description covering: asset name/type, what it does, what userConfig it collects, any setup scripts the reviewer should be aware of

## 11. Tests

- [x] 11.1 Add unit tests for `fetchManifest` (success, 404 failure, malformed JSON)
- [x] 11.2 Add unit tests for `storeCredential` / `getCredential` (keychain path + fallback path)
- [x] 11.3 Add unit tests for `collectUserConfig` (new keys prompted, existing keys skipped, sensitive masked)
- [x] 11.4 Add unit tests for `substituteUserConfig` (non-sensitive replaced, sensitive left as-is)
- [x] 11.5 Add install engine integration test: folder-based asset with userConfig installs correctly, configuredFiles excluded from lockfile, gitignore updated
- [x] 11.6 Add update engine integration test: configuredFiles preserved on update, `reconfigurationNeeded` set when no `configStable`, not set when `configStable: true`
- [x] 11.7 Add remove engine integration test: postUninstall notice returned when manifest declares it
- [x] 11.8 Add test for `checkSetupPending`: returns true without `.setup-complete`, false with it
- [x] 11.9 Add credential storage tests: keytar success path, keytar failure → credentials file fallback, one-time info message emitted only once
