# Script Risks — dev-workflow Plugin

## What the scripts do

The `dev-workflow` plugin does **not** currently declare `postInstall` or `postUninstall` scripts.
The `pre-push-reminder.sh` hook file is installed into your project folder and must be manually
registered with your git configuration if you choose to use it.

## What is installed on disk

- `.claude-plugin/plugin.json` — plugin metadata for Claude Code
- `agents/planner.md` — planning agent prompt
- `skills/commit/SKILL.md` — conventional commit skill
- `hooks/hooks.json` — hook configuration
- `hooks/pre-push-reminder.sh` — shell script (not auto-executed, manual setup required)

## Manual setup (optional)

To activate the pre-push hook, add the following to your `.git/hooks/pre-push` (or use
`git config core.hooksPath` to point at the hooks folder):

```sh
#!/bin/sh
node .claude-plugin/hooks/pre-push-reminder.sh "$@"
```

## Manual cleanup

1. Delete the installed asset folder (ai-stash `remove` handles this).
2. If you registered the hook manually, remove it from `.git/hooks/pre-push`.

## No postUninstall Script

This plugin has no `postUninstall` script because the hook registration is purely opt-in
and manual. ai-stash cannot know whether you registered the hook, so cleanup is left to you.
