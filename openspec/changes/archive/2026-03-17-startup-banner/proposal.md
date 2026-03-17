## Why

When `ai-stash` launches, the terminal jumps straight into the TUI with no context. A brief animated banner gives the tool a polished first impression and surfaces the tool name, version, and purpose before the main interface loads.

## What Changes

- Add an animated startup banner that renders for ~1.5s before transitioning to the main `App` TUI
- Banner displays the `ai-stash` logo (ASCII art), current version (from `package.json`), and the tool description

## Capabilities

### New Capabilities

- `startup-banner`: Animated banner component shown at CLI startup — renders logo, version, and description with a brief entrance animation, then unmounts and hands off to the main App

### Modified Capabilities

- `cli-scaffold`: Entry point (`src/cli.tsx`) is modified to render the banner before mounting `App`

## Impact

- **`src/cli.tsx`** — render `Banner` before `App`; transition on animation complete
- **`src/ui/components/Banner.tsx`** — new component (ASCII logo + version + description + animation)
- **`package.json`** — version string read at build time (injected via `tsx` or `import`)
