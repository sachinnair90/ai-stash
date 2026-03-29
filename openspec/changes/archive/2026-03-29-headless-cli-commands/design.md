## Context

ai-stash's engine layer (`planInstall`, `executeInstall`, `installAssetFull`, `checkUpdates`, `updateAsset`, `removeAssetFull`, `syncFromLockfile`) is already headless — it operates on plain data and performs no UI rendering. The TUI is a thin interaction layer on top. The CLI entry point (`cli.tsx`) already routes `registry` subcommands before rendering Ink, establishing the pattern to follow.

The new headless commands are thin shells: parse args → resolve registry → call engine → print result → exit.

## Goals / Non-Goals

**Goals:**
- Full headless surface: `add`, `remove`, `update`, `list`, `sync`
- No engine changes — all new code lives in `src/commands/`
- CI-safe: deterministic defaults when stdout is not a TTY
- Consistent exit codes (0 = success, 1 = error)

**Non-Goals:**
- One-off `--from <url>` installs (deferred)
- JSON output mode / machine-readable output (can add later)
- Interactive conflict resolution in headless mode (existing default: overwrite)

## Decisions

### D1: Routing pattern — match existing `registry` approach

Each subcommand verb (`add`, `remove`, `update`, `list`, `sync`) is detected in `cli.tsx` before `render(<App />)`. Each verb maps to a `src/commands/<verb>.ts` module that exports a `handle<Verb>Command(args)` function.

_Alternative: a full CLI parser (yargs, commander). Rejected — the existing `registry.ts` uses manual `args[]` parsing and the command surface is small enough that a dependency is not justified._

### D2: Registry selection

`resolveRegistry(args, lockfile)` helper in a shared `src/commands/utils.ts`:

```
--registry <name> supplied  →  look up in lockfile.registries, error if not found
0 registries                →  error: "no registries configured"
1 registry                  →  use it silently
2+ registries, TTY          →  readline prompt, numbered list, default = first (Enter accepts)
2+ registries, non-TTY      →  auto-select first, warn to stderr
```

_Alternative: always require `--registry` when multiple configured. Rejected — too verbose for the common single-registry case._

### D3: `add` idempotency

Check lockfile for an existing entry matching `type` + `name` (any registry prefix):
- Same version installed → print "already installed (X.Y.Z), nothing to do", exit 0
- Different version installed → print "already installed (X.Y.Z), use 'update' to upgrade", exit 0
- Not found → proceed with install

_Rationale: idempotent `add` is safe in scripts and Makefiles. Erroring on reinstall is surprising and breaks `|| true` patterns._

### D4: `remove` lookup

Match by last key segment (`name`) AND `type` field in `InstalledAsset`. Walk `lockfile.installed` entries, split key on `:`, check `parts[1] === type && parts[2] === name`. Error if not found. If multiple matches (same name+type from two registries — unusual), remove all and warn.

### D5: `list` output

Plain `console.log` table, padded with spaces. No external table library. Columns: `TYPE`, `NAME`, `VERSION`, `SCOPE`, `REGISTRY`. Derived from `lockfile.installed` entries — registry name from key prefix, asset name from key suffix, rest from `InstalledAsset`.

### D6: GitHub token resolution

Reuse the same `getGitHubToken()` helper used by the TUI (`gh auth token` → `GITHUB_TOKEN` env). Commands pass it through to engine functions unchanged.

## Risks / Trade-offs

- **Multi-match on remove**: same-name+type from two registries is possible after a conflict-suffix install. The suffix changes the disk name but not the lockfile type+name. D4 handles by removing all matches with a warning — this is the safe behaviour.
- **readline prompt in TTY detection**: Node's `process.stdout.isTTY` is `undefined` (falsy) when piped. This is the correct check for non-interactive detection.
- **No structured output**: `list` and error messages are human-readable. If scripting needs parseable output, `--json` can be added later without breaking the current surface.
