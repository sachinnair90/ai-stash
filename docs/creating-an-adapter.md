# Creating a new adapter

An **adapter** teaches ai-stash how to install assets for a specific AI tool (e.g. Claude Code, GitHub Copilot). It maps generic asset types to the file paths and formats that the target tool expects.

## What an adapter does

Every adapter implements four responsibilities:

| Method | Responsibility |
|--------|---------------|
| `getInstallPaths()` | Returns the absolute paths where asset files should be written |
| `transformFiles()` | Rewrites file content for the target platform (e.g. different frontmatter, different JSON keys) |
| `mergeIntoExisting()` | Handles assets that write into shared files (e.g. appending to `CLAUDE.md`) |
| `removeAsset()` | Cleans up files and shared file entries when an asset is uninstalled |

## Step-by-step

### 1. Create the adapter file

```
src/adapters/my-tool/index.ts
```

Implement the `Adapter` interface from `src/adapters/types.ts`:

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Adapter, AssetType } from '../types.js';
import type { RegistryAsset } from '../../registry/types.js';
import type { InstalledAsset } from '../../lockfile/types.js';

export const myToolAdapter: Adapter = {
  name: 'my-tool',  // must match the target name used in registry.json

  getInstallPaths(asset: RegistryAsset, scope: 'project' | 'global', projectRoot: string): string[] {
    const assetType = asset.type as AssetType;
    const base = scope === 'global'
      ? path.join(os.homedir(), '.my-tool')
      : path.join(projectRoot, '.my-tool');

    switch (assetType) {
      case 'skill':
        return asset.files.map(f => path.join(base, 'skills', asset.name, path.basename(f)));
      case 'agent':
        return [path.join(base, 'agents', `${asset.name}.md`)];
      case 'instruction':
        return [path.join(projectRoot, 'MY-TOOL.md')];
      // add cases for every AssetType your tool supports
      default:
        return [];
    }
  },

  transformFiles(asset: RegistryAsset, files: Record<string, string>): Record<string, string> {
    const assetType = asset.type as AssetType;

    switch (assetType) {
      case 'instruction': {
        // wrap content in section markers so it can be surgically removed later
        const result: Record<string, string> = {};
        for (const [filePath, content] of Object.entries(files)) {
          result[filePath] = `<!-- ai-stash:${asset.name} -->\n${content}\n<!-- /ai-stash:${asset.name} -->`;
        }
        return result;
      }
      default:
        return files;  // pass through unchanged
    }
  },

  mergeIntoExisting(assetName: string, existing: string, incoming: string, assetType: AssetType): string {
    if (assetType === 'instruction') {
      // example: replace an existing block or append
      const startMarker = `<!-- ai-stash:${assetName} -->`;
      const endMarker = `<!-- /ai-stash:${assetName} -->`;
      const start = existing.indexOf(startMarker);
      const end = existing.indexOf(endMarker);
      if (start !== -1 && end !== -1) {
        return existing.slice(0, start) + incoming + existing.slice(end + endMarker.length);
      }
      return existing + '\n\n' + incoming;
    }
    return incoming;  // default: overwrite
  },

  async removeAsset(asset: InstalledAsset, projectRoot: string): Promise<void> {
    for (const filePath of asset.files) {
      const fullPath = path.resolve(projectRoot, filePath);
      try {
        await fs.unlink(fullPath);
        // clean up empty parent directory
        const dir = path.dirname(fullPath);
        if ((await fs.readdir(dir)).length === 0) await fs.rmdir(dir);
      } catch { /* already deleted */ }
    }
  },
};
```

### 2. Register the adapter

Open `src/adapters/index.ts` and add two lines:

```typescript
import { myToolAdapter } from './my-tool/index.js';    // add this
registerAdapter(myToolAdapter);                          // add this
```

The adapter is now available for install/update/remove operations.

### 3. Declare the target in registry assets

Assets that support your tool must list `"my-tool"` in their `targets` array in `registry.json`:

```json
{
  "name": "my-skill",
  "targets": ["claude-code", "my-tool"]
}
```

Assets that don't list `"my-tool"` in `targets` will not be shown as installable for that tool.

### 4. Write tests

Create `src/__tests__/my-tool-adapter.test.ts` following the pattern in `claude-code-adapter.test.ts` or `copilot-adapter.test.ts`. At minimum test:

- `getInstallPaths` for every asset type you handle
- `transformFiles` for types that need content transformation
- `mergeIntoExisting` for types that write to shared files
- `removeAsset` leaves no orphan files

## Reference: Adapter interface

```typescript
export interface Adapter {
  name: string;
  getInstallPaths(asset: RegistryAsset, scope: 'project' | 'global', projectRoot: string): string[];
  transformFiles(asset: RegistryAsset, files: Record<string, string>): Record<string, string>;
  mergeIntoExisting(assetName: string, existing: string, incoming: string, assetType: AssetType): string;
  removeAsset(asset: InstalledAsset, projectRoot: string): Promise<void>;
}
```

## Notes

- `getInstallPaths` returns **absolute paths**. The install engine uses them verbatim.
- Return `[]` from `getInstallPaths` for unsupported asset types — the engine will skip them.
- `transformFiles` receives the **raw fetched content** keyed by registry-relative file path (e.g. `skills/my-skill/SKILL.md`). Return a new map with the same keys but transformed values.
- `mergeIntoExisting` is only called when a target file **already exists on disk**. For fresh installs the engine calls `transformFiles` and writes directly.
- The `name` field must exactly match what registry assets use in their `targets` array.
