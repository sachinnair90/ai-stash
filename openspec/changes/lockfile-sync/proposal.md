## Why

When a team commits `ai-stash.lock.json` to their repository, teammates must manually browse and reinstall every asset one-by-one after cloning — there is no equivalent of `npm install` that reads the lockfile and installs everything automatically. This friction discourages teams from adopting shared AI assistant setups.

## What Changes

- Add a **Sync view** in the TUI that reads the local `ai-stash.lock.json`, compares it against locally installed files, identifies missing or out-of-date assets, and installs them in one operation
- Add a keyboard shortcut (`s`) in the Browse view to enter the Sync view
- Show a count of unsynced assets in the footer when a lockfile is present and assets are missing
- Update the README to document the sync workflow

## Capabilities

### New Capabilities

- `lockfile-sync`: Detect assets recorded in the lockfile that are not yet installed locally and install them in batch, respecting the recorded scope, targets, and version from the lockfile

### Modified Capabilities

- `asset-installation`: The install engine must accept pre-resolved scope and targets from a lockfile entry rather than prompting the user for them

## Impact

- New `SyncView` component under `src/ui/views/`
- New `syncFromLockfile` function in the install engine
- `src/ui/App.tsx` — new view route and footer badge
- `src/ui/components/Footer.tsx` — unsynced asset count
- README — update team sharing section
