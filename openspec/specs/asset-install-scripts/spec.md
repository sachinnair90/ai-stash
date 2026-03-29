## ADDED Requirements

### Requirement: Detect and surface postInstall script notice
The system SHALL detect a `scripts.postInstall` entry in `manifest.json` after completing file installation and SHALL print a notice instructing the user to run the script manually. The engine SHALL NOT execute the script.

#### Scenario: postInstall script notice after install
- **WHEN** installation of a folder-based asset completes and `manifest.json` declares `scripts.postInstall`
- **THEN** the engine prints a notice with the absolute path of the script and the command to run it (e.g., `node .claude/hooks/my-hook/setup.js`)

#### Scenario: No notice when no postInstall script
- **WHEN** installation completes and the manifest has no `scripts.postInstall`
- **THEN** the engine prints no script notice

#### Scenario: Engine never executes the script
- **WHEN** any install or update is triggered
- **THEN** the engine does not invoke the script via any execution mechanism

### Requirement: Detect and surface postUninstall script notice
The system SHALL detect a `scripts.postUninstall` entry in the installed asset's `manifest.json` after removing the asset files and SHALL print a notice instructing the user to run the script manually.

#### Scenario: postUninstall script notice after remove
- **WHEN** removal of a folder-based asset completes and the manifest declares `scripts.postUninstall`
- **THEN** the engine prints a notice indicating the script should be run for cleanup

#### Scenario: Manifest read from installed path during removal
- **WHEN** an asset is being removed
- **THEN** the engine reads `manifest.json` from the installed asset folder before deleting files, to determine if a postUninstall notice is needed

### Requirement: Scripts must be Node.js

The system SHALL only recognise `.js` or `.mjs` files as valid script values in `manifest.json` `scripts` fields. The `add-asset` authoring skill SHALL warn authors who specify any other extension. Additionally, when scripts are declared, the `add-asset` skill SHALL require the author to provide a `SCRIPT_RISKS.md` file and to declare a `scriptRisks` path in the manifest. The skill SHALL also warn if `scripts.postInstall` is declared without a corresponding `scripts.postUninstall`, requiring the author to either add `postUninstall` or document why full cleanup is not possible in `SCRIPT_RISKS.md`.

Script content for hashing is read from the already-fetched `rawFiles` map (keyed by the script filename as declared in the manifest). No additional network fetch is made at hash time.

#### Scenario: Valid Node.js script extension

- **WHEN** a manifest declares `"postInstall": "setup.js"` or `"postInstall": "setup.mjs"`
- **THEN** the engine treats it as a valid script and surfaces the notice with a `node` invocation prefix

#### Scenario: Authoring warning for non-Node script

- **WHEN** the `add-asset` skill generates a manifest and the author specifies a `.sh` or `.py` script
- **THEN** the skill warns that non-Node scripts will not work cross-platform and suggests a Node.js equivalent

#### Scenario: add-asset skill requires SCRIPT_RISKS.md when scripts declared

- **WHEN** an author uses the `add-asset` skill and declares any `scripts` field in the manifest
- **THEN** the skill prompts for the content of `SCRIPT_RISKS.md` and will not produce a complete asset without it

#### Scenario: add-asset skill requires postUninstall or documented justification

- **WHEN** an author uses the `add-asset` skill and declares `scripts.postInstall` without `scripts.postUninstall`
- **THEN** the skill warns and requires the author to either add `postUninstall` or include a "No cleanup script" section in `SCRIPT_RISKS.md` explaining what the developer must do manually

#### Scenario: Script hash computed from rawFiles without extra fetch

- **WHEN** an asset with scripts is installed
- **THEN** the engine reads script content from the `rawFiles` map already populated during `planInstall` and does not make an additional network request to fetch the script content for hashing

### Requirement: scriptRisks field in manifest schema

A `manifest.json` MAY declare a `scriptRisks` field containing a registry-root-relative path to an author-written risk documentation file (conventionally `SCRIPT_RISKS.md`). This file SHALL be fetched on-demand during the install disclaimer phase and SHALL NOT be listed in `files[]` or installed on disk.

#### Scenario: Manifest with scriptRisks field

- **WHEN** a `manifest.json` declares `"scriptRisks": "plugins/my-plugin/SCRIPT_RISKS.md"`
- **THEN** the engine can fetch and display that file during the disclaimer phase without installing it

#### Scenario: Manifest without scriptRisks field

- **WHEN** a `manifest.json` declares scripts but no `scriptRisks` field
- **THEN** the engine proceeds with only the generic risk list in the disclaimer; no error is raised

### Requirement: hasScripts flag on RegistryAsset

A `RegistryAsset` entry in `registry.json` MAY declare `hasScripts: true` to indicate that the asset's manifest contains one or more script declarations. This flag is set by the asset author or registry build tooling and is used for UI badging without requiring a manifest fetch.

#### Scenario: Registry entry with hasScripts

- **WHEN** a registry entry has `hasScripts: true`
- **THEN** the browse view shows the asset with a "has setup script" badge

#### Scenario: Registry entry without hasScripts

- **WHEN** a registry entry has no `hasScripts` field or `hasScripts: false`
- **THEN** no script badge is shown for that asset in browse

### Requirement: Setup completion sentinel
The system SHALL check for a `.setup-complete` file in the installed asset folder when displaying asset status. Assets with a `scripts.postInstall` that lack `.setup-complete` SHALL be shown as "setup pending".

#### Scenario: Asset shown as setup pending
- **WHEN** `ai-stash status` is run and an installed folder-based asset has `scripts.postInstall` but no `.setup-complete` file
- **THEN** the asset is listed with a "setup pending" indicator

#### Scenario: Asset shown as fully set up
- **WHEN** `ai-stash status` is run and an installed folder-based asset with `scripts.postInstall` has a `.setup-complete` file present
- **THEN** the asset is listed without a pending indicator

#### Scenario: .setup-complete is always gitignored
- **WHEN** a folder-based asset with `scripts.postInstall` is installed
- **THEN** `.setup-complete` is automatically added to `configuredFiles` (and thus to `.gitignore`) even if the author did not declare it
