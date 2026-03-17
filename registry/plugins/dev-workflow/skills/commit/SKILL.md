---
name: commit
description: Generate a Conventional Commits-compliant commit message from staged changes. Run after staging files and before committing.
---

# Commit Skill

Analyse the staged diff and produce a ready-to-run `git commit` command.

## Steps

1. Run `git diff --staged` to read all staged changes
2. Identify the primary change type from the diff:
   - `feat` — new capability or behaviour
   - `fix` — bug correction
   - `refactor` — restructuring without behaviour change
   - `test` — adding or updating tests
   - `docs` — documentation only
   - `chore` — build, deps, tooling
   - `perf` — performance improvement
3. Identify the scope (optional) — the module, component, or area most affected
4. Write a subject line: imperative mood, ≤72 chars, no full stop
5. If the change needs explanation, add a body (blank line after subject)
6. If there are breaking changes, add a footer: `BREAKING CHANGE: <description>`

## Output

Print **only** the ready-to-run git command, nothing else:

```
git commit -m "type(scope): subject

Optional body explaining why, not what.

BREAKING CHANGE: optional footer"
```

## Examples

```
git commit -m "feat(auth): add refresh token rotation on login"
```

```
git commit -m "fix(api): return 404 instead of 500 on missing resource"
```

```
git commit -m "refactor(engine): extract planInstall into separate module

Separates concern between planning and execution.
Makes each function independently testable."
```

## Rules

- Subject line is **imperative mood** — "add", not "adds" or "added"
- No emoji unless the project already uses them in commit history
- Scope is optional but preferred for multi-module repos
- Body explains **why**, not what (the diff already shows what)
