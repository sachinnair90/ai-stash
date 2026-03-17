---
name: create-adapter
description: Scaffold a new ai-stash adapter that teaches the tool how to install assets for a new AI platform. Reads existing adapters as reference, implements the Adapter interface, registers it, and creates a test file.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Create Adapter

Scaffold a complete adapter for a new AI tool target in the ai-stash project.

## What to ask the user first

If the target platform name was not provided, ask:
- **Target name**: the short identifier used in `registry.json` `targets` arrays (e.g. `cursor`, `windsurf`, `aider`). Use kebab-case.
- **Base config directory**: where the platform stores its config files (e.g. `.cursor/` in the project root, or `~/.cursor/` globally)
- **Which asset types does this platform support?** (skill / agent / instruction / hook / command / plugin / mcp-server)

## Steps

### 1. Read the existing adapters for reference

```
src/adapters/types.ts
src/adapters/index.ts
src/adapters/claude-code/index.ts
src/adapters/copilot/index.ts
```

Study the full implementation of both adapters. Note:
- How `getInstallPaths` maps each `AssetType` to a path
- Which types use `mergeIntoExisting` (instruction, hook, mcp-server)
- How `removeAsset` handles types that write to shared files vs standalone files
- The section-marker pattern used for `instruction` merging

### 2. Check what already exists

```bash
ls src/adapters/
```

If a directory for the target already exists, stop and tell the user.

### 3. Scaffold the adapter

Create `src/adapters/{target-name}/index.ts`.

Follow this structure exactly:

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Adapter, AssetType } from '../types.js';
import type { RegistryAsset } from '../../registry/types.js';
import type { InstalledAsset } from '../../lockfile/types.js';

export const {camelCaseName}Adapter: Adapter = {
  name: '{target-name}',

  getInstallPaths(asset: RegistryAsset, scope: 'project' | 'global', projectRoot: string): string[] {
    const assetType = asset.type as AssetType;
    const base = scope === 'global'
      ? path.join(os.homedir(), '{global-config-dir}')
      : path.join(projectRoot, '{project-config-dir}');

    switch (assetType) {
      // implement each supported type
      // return [] for unsupported types
      default:
        return [];
    }
  },

  transformFiles(asset: RegistryAsset, files: Record<string, string>): Record<string, string> {
    const assetType = asset.type as AssetType;
    switch (assetType) {
      // add cases only where content transformation is needed
      default:
        return files;
    }
  },

  mergeIntoExisting(assetName: string, existing: string, incoming: string, assetType: AssetType): string {
    // add cases for types that write to shared files (instruction, hook, mcp-server)
    return incoming;
  },

  async removeAsset(asset: InstalledAsset, projectRoot: string): Promise<void> {
    for (const filePath of asset.files) {
      const fullPath = path.resolve(projectRoot, filePath);
      try {
        await fs.unlink(fullPath);
        const dir = path.dirname(fullPath);
        if ((await fs.readdir(dir)).length === 0) await fs.rmdir(dir);
      } catch { /* already deleted */ }
    }
  },
};
```

Fill in every `case` for the asset types the user listed as supported. For unsupported types return `[]` from `getInstallPaths` — the engine skips them automatically.

**instruction type**: wrap content in `<!-- ai-stash:{name} --> ... <!-- /ai-stash:{name} -->` markers in `transformFiles`; implement marker-based merge and removal in `mergeIntoExisting` and `removeAsset`.

**mcp-server type**: read the pattern from `claude-code/index.ts` — extract the `mcpServers` key and merge by key name.

### 4. Register the adapter

Open `src/adapters/index.ts` and add two lines after the existing imports and `registerAdapter` calls:

```typescript
import { {camelCaseName}Adapter } from './{target-name}/index.js';
registerAdapter({camelCaseName}Adapter);
```

### 5. Run the type-checker

```bash
pnpm run typecheck
```

Fix any type errors before continuing.

### 6. Create a test file

Create `src/__tests__/{target-name}-adapter.test.ts`.

Model it on `claude-code-adapter.test.ts` or `copilot-adapter.test.ts`. At minimum include tests for:

- `getInstallPaths` for every supported asset type at both `project` and `global` scope
- `transformFiles` for any type with custom transformation logic
- `mergeIntoExisting` for types that write to shared files
- `removeAsset` removes the correct files and leaves no orphan directories

Run the tests:

```bash
pnpm run test
```

### 7. Summarise what was created

List:
- The adapter file path
- Which asset types were implemented (and which were left as `return []`)
- Any TODOs or known limitations for the new adapter
- A reminder to update `registry.json` assets to include `"{target-name}"` in their `targets` arrays if they should be installable on the new platform

## Key rules

- `getInstallPaths` must return **absolute paths**
- Every `AssetType` value must have a `case` or fall through to `default: return []`
- Never swallow errors silently in `removeAsset` without a comment explaining why
- Keep the adapter file under 300 lines — extract helpers if needed
- The `name` field on the adapter object must exactly match the string used in `targets` arrays in `registry.json`
