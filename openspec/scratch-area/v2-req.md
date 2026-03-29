# V2 Requirements

## Asset Management

- Asset creation and management
- Update assets
- Integrity checks for installed assets
- Auto-install dependencies (MCP, agents, etc.)

## Platform & Sources

- Assistant-specific artifacts
- BYOR (Bring Your Own Registry)
- Add support for [awesome-copilot](https://github.com/github/awesome-copilot) & [Anthropic skills](https://github.com/anthropics/skills)

## Developer Experience

- Scheduled tasks
- Better guardrails
- Ask follow-up questions to fill in missing information (MCP tokens, placeholder values, etc.)    "ai-stash": "github:sachinnair90/ai-stash#v1",
- headless mode (no UI, just API)
- ontime-assets: assets that are only installed when needed, and uninstalled when not needed
- each asset can have pre-install/uninstall and post-install/uninstall scripts which should be run before/after installing/uninstalling the asset. This can be used to set up the environment, check for dependencies, etc.
- when mapping an asset from a source type to target type, we should be able to strip source-specific fields and replace them with target-specific fields. For example, lifecycle of Claude code is different from lifecycle of a GitHub Copilot code, so we should be able to strip the lifecycle field from the source asset and replace it with the appropriate lifecycle field for the target asset. This will allow us to have a more flexible mapping system that can handle different source and target types without having to define a new mapping for each combination of source and target types.
- make all scripts for windows compatible (use cross-platform scripting languages like Python or Node.js, or use platform-specific scripts and run the appropriate script based on the user's operating system)

