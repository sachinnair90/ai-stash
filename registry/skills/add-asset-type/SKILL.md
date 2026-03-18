---
name: add-asset-type
description: Add a new asset type to ai-stash. Updates the type union, registry fetcher, both adapters, the TUI colour map, the filter hook, and the registry schema — then verifies with the type-checker.
allowed-tools: Read, Edit, Bash, Grep
---

# Add Asset Type

Introduce a new asset type (e.g. `template`, `workflow`, `snippet`) across the entire ai-stash codebase.

## What to ask the user first

If not already provided:
- **Type name**: the singular kebab-case identifier (e.g. `template`). This becomes the literal in the `AssetType` union.
- **Registry bucket name**: the camelCase plural key used in `registry.json` (e.g. `templates`). By convention: camelCase plural.
- **TUI colour**: what colour to show the type badge in the Browse view (e.g. `white`, `magenta`, `blueBright`). See [Ink colours](https://github.com/chalk/chalk#colors).
- **Claude Code install path**: where files of this type go for Claude Code (e.g. `.claude/templates/{name}/`).
- **Copilot install path**: where files go for Copilot, or `none` if unsupported.

## Files to read before making changes

```
src/adapters/types.ts
src/registry/types.ts
src/registry/fetcher.ts
src/ui/hooks/useFilter.ts
src/ui/components/AssetList.tsx
src/adapters/claude-code/index.ts
src/adapters/copilot/index.ts
```

Read all of them first. Understand the existing patterns before editing.

## Steps

### 1. Extend the AssetType union — `src/adapters/types.ts`

Add the new literal to the union:

```typescript
export type AssetType =
  | 'skill' | 'agent' | 'instruction' | 'hook'
  | 'command' | 'plugin' | 'mcp-server'
  | '{new-type}';   // ← add here
```

### 2. Mirror the change in the UI filter hook — `src/ui/hooks/useFilter.ts`

This file has its own copy of the union. Add the same literal in the same position.

### 3. Add the registry bucket type — `src/registry/types.ts`

Find the `NestedRegistryIndex` interface and add the new bucket as an optional field:

```typescript
{bucketName}?: Omit<RegistryAsset, 'type'>[];
```

### 4. Map the bucket in the fetcher — `src/registry/fetcher.ts`

In the `BUCKET_TO_TYPE` object, add:

```typescript
{bucketName}: '{new-type}',
```

The key must exactly match the JSON property name in `registry.json`.

### 5. Add install paths to the Claude Code adapter — `src/adapters/claude-code/index.ts`

In `getInstallPaths`, add a new `case` inside the `switch (assetType)`:

```typescript
case '{new-type}':
  return asset.files.map(f =>
    path.join(base, '{install-subdir}', asset.name, path.basename(f))
  );
```

If the type needs content transformation, add a matching `case` in `transformFiles`. Otherwise the `default: return files` branch handles it.

If the type writes to a shared file (like `instruction` writes to `CLAUDE.md`), also implement:
- A `case` in `mergeIntoExisting`
- Special handling in `removeAsset`

### 6. Add install paths to the Copilot adapter — `src/adapters/copilot/index.ts`

Same pattern. If the type is not supported on Copilot:

```typescript
case '{new-type}':
  return [];   // not supported on Copilot
```

Never omit the case entirely — the `default` branch is for future-proofing, not for skipping known types.

### 7. Add the TUI colour — `src/ui/components/AssetList.tsx`

In the `typeColors` map, add:

```typescript
'{new-type}': '{colour}',
```

### 8. Type-check

```bash
pnpm run typecheck
```

TypeScript will catch any missed switch cases or interface mismatches. Fix all errors before continuing.

### 9. Run the tests

```bash
pnpm run test
```

The existing adapter tests should still pass. If any test has an exhaustive check on `AssetType` it will need updating.

### 10. Summarise

Report:
- All files changed
- The install paths for the new type on each adapter
- Any open TODOs (e.g. merge/remove logic not yet implemented)
- A reminder to add actual assets of the new type to `registry.json` using the `add-asset` skill

## Key rules

- The type literal in `AssetType`, `useFilter.ts`, and the `BUCKET_TO_TYPE` value must all be identical strings
- The `BUCKET_TO_TYPE` key (the bucket name) must be the exact JSON property name in `registry.json`
- Every `AssetType` case must appear in both adapters' `getInstallPaths` — never rely on `default` for a known type
- Colours must be valid Ink/chalk colour names (strings, not hex)
