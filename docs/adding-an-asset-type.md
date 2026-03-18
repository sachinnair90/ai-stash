# Adding a new asset type

An **asset type** is a category of AI assistant asset (e.g. `skill`, `agent`, `hook`). Adding a new type touches five locations: the type union, the registry fetcher, both adapters, the UI colour map, and the filter hook.

## Checklist

- [ ] Add the literal to `AssetType` in `src/adapters/types.ts`
- [ ] Add the literal to `AssetType` in `src/ui/hooks/useFilter.ts`
- [ ] Add the registry bucket mapping in `src/registry/fetcher.ts`
- [ ] Handle the type in `src/adapters/claude-code/index.ts`
- [ ] Handle the type in `src/adapters/copilot/index.ts`
- [ ] Add a colour in `src/ui/components/AssetList.tsx`
- [ ] Add the bucket to `NestedRegistryIndex` in `src/registry/types.ts`

---

## Step-by-step

### 1. Extend AssetType — `src/adapters/types.ts`

```typescript
export type AssetType =
  | 'skill' | 'agent' | 'instruction' | 'hook'
  | 'command' | 'plugin' | 'mcp-server'
  | 'my-type';   // add here
```

### 2. Mirror the change in the UI filter hook — `src/ui/hooks/useFilter.ts`

This file has its own copy of the union (rather than importing it). Add the new literal in the same position:

```typescript
export type AssetType =
  | 'skill' | 'agent' | 'instruction' | 'hook'
  | 'command' | 'plugin' | 'mcp-server'
  | 'my-type';   // add here
```

### 3. Map the registry bucket — `src/registry/fetcher.ts`

The fetcher maps JSON bucket names (plural) to `AssetType` values (singular):

```typescript
const BUCKET_TO_TYPE: Record<string, string> = {
  skills: 'skill',
  agents: 'agent',
  // ... existing entries ...
  myTypes: 'my-type',   // add: camelCase plural → singular type string
};
```

The key must match the JSON property name in `registry.json`.

### 4. Declare the bucket on NestedRegistryIndex — `src/registry/types.ts`

```typescript
export interface NestedRegistryIndex {
  version: number;
  generatedAt: string;
  skills?: Omit<RegistryAsset, 'type'>[];
  // ... existing buckets ...
  myTypes?: Omit<RegistryAsset, 'type'>[];   // add here
}
```

### 5. Handle install paths — both adapters

In **`src/adapters/claude-code/index.ts`** add a `case` inside `getInstallPaths`:

```typescript
case 'my-type':
  return asset.files.map(f =>
    path.join(base, 'my-types', asset.name, path.basename(f))
  );
```

Add a matching `case` in **`src/adapters/copilot/index.ts`** (or return `[]` if the type isn't supported on Copilot):

```typescript
case 'my-type':
  return [];  // unsupported on Copilot — skip silently
```

### 6. Handle content transformation — both adapters

In `transformFiles` in both adapters, add a `case` if the type needs any content rewriting. If the files should be installed as-is, the `default: return files` branch handles it and no extra case is needed.

```typescript
case 'my-type': {
  // example: inject a required header comment
  const result: Record<string, string> = {};
  for (const [filePath, content] of Object.entries(files)) {
    result[filePath] = `# Installed by ai-stash\n\n${content}`;
  }
  return result;
}
```

### 7. Handle removal — both adapters

If the type writes to shared files (like `instruction` writes to `CLAUDE.md` or `hook` writes to `settings.json`), add special removal logic in `removeAsset`. Otherwise the default loop in the adapter (which calls `fs.unlink` per file) handles it.

### 8. Add a TUI colour — `src/ui/components/AssetList.tsx`

The type badge in the Browse view is coloured by this map. Pick any [Ink colour](https://github.com/chalk/chalk#colors):

```typescript
const typeColors: Record<string, string> = {
  skill: 'green',
  agent: 'blue',
  // ... existing entries ...
  'my-type': 'magenta',   // add here
};
```

---

## Example: adding a `template` type

Imagine templates are reusable file scaffolds. They install as plain files in `.claude/templates/{name}/`.

**`src/adapters/types.ts`**
```typescript
export type AssetType = ... | 'template';
```

**`src/registry/fetcher.ts`**
```typescript
templates: 'template',
```

**`src/registry/types.ts`**
```typescript
templates?: Omit<RegistryAsset, 'type'>[];
```

**`src/adapters/claude-code/index.ts`** — `getInstallPaths`:
```typescript
case 'template':
  return asset.files.map(f =>
    path.join(base, 'templates', asset.name, path.basename(f))
  );
```

**`src/adapters/copilot/index.ts`** — `getInstallPaths`:
```typescript
case 'template':
  return asset.files.map(f =>
    path.join(projectRoot, '.github', 'templates', asset.name, path.basename(f))
  );
```

**`src/ui/components/AssetList.tsx`**
```typescript
template: 'white',
```

**`src/ui/hooks/useFilter.ts`**
```typescript
export type AssetType = ... | 'template';
```

**`registry/registry.json`** — add a new bucket:
```json
{
  "templates": [
    {
      "name": "pr-template",
      "version": "1.0.0",
      "description": "Standard pull request template",
      "tags": ["git", "workflow"],
      "targets": ["claude-code"],
      "files": ["templates/pr-template/PULL_REQUEST_TEMPLATE.md"],
      "manifestUrl": "templates/pr-template/PULL_REQUEST_TEMPLATE.md"
    }
  ]
}
```
