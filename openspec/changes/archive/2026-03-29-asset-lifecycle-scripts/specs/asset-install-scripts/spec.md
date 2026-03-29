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
The system SHALL only recognise `.js` or `.mjs` files as valid script values in `manifest.json` `scripts` fields. The `add-asset` authoring skill SHALL warn authors who specify any other extension.

#### Scenario: Valid Node.js script extension
- **WHEN** a manifest declares `"postInstall": "setup.js"` or `"postInstall": "setup.mjs"`
- **THEN** the engine treats it as a valid script and surfaces the notice with a `node` invocation prefix

#### Scenario: Authoring warning for non-Node script
- **WHEN** the `add-asset` skill generates a manifest and the author specifies a `.sh` or `.py` script
- **THEN** the skill warns that non-Node scripts will not work cross-platform and suggests a Node.js equivalent

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
