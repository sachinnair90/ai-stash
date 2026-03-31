## ADDED Requirements

### Requirement: Plugin is registered in the ai-stash registry
The specship plugin SHALL be registered in `registry/registry.json` under the `plugins` array with a valid name, version, description, tags, targets, and folder path.

#### Scenario: Plugin appears in registry browse
- **WHEN** a user browses the ai-stash registry
- **THEN** specship appears as an installable plugin with description, tags, and targets

### Requirement: Plugin installs via standard ai-stash plugin machinery
The plugin SHALL use the folder-based plugin format with a `manifest.json` declaring all installed files, `scripts.postInstall`, and `scriptRisks`.

#### Scenario: Plugin installs via plugin folder
- **WHEN** a user runs `ai-stash add plugin specship`
- **THEN** all files listed in `manifest.json` are installed to the correct target paths

#### Scenario: Risk disclaimer shown before install
- **WHEN** a user attempts to install specship
- **THEN** ai-stash shows the generic script risk disclaimer and the content of `SCRIPT_RISKS.md` before proceeding

### Requirement: Plugin declares a postUninstall script
The plugin SHALL declare a `postUninstall` script in `manifest.json` alongside `postInstall`, so Squad ceremony and routing patches can be cleanly removed.

#### Scenario: Uninstall removes Squad patches
- **WHEN** a user runs `ai-stash remove specship` and then runs the postUninstall script
- **THEN** the `spec-gate` ceremony entry and Speccer routing entry are removed from `.squad/ceremonies.md` and `.squad/routing.md`
- **THEN** `.squad/agents/speccer/` is moved to `.squad/agents/_alumni/speccer/`
