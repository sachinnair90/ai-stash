---
description: Perform a tiered code review on staged or recent changes. Analyses security, code quality, performance, and best practices. Use after writing or modifying code, or before opening a PR.
---

# Code Review Skill

## Overview

Run a structured, severity-tiered review of the current code changes. Work through staged changes (`git diff --staged`) and recent unstaged changes (`git diff`). Read surrounding context — do not review diffs in isolation.

## Review Tiers

### CRITICAL — Block merge

Flag these unconditionally:

- **Hardcoded secrets**: API keys, passwords, tokens, connection strings in source or logs
- **Injection vulnerabilities**: SQL, shell, or template injection via string concatenation
- **XSS**: Unescaped user input rendered in HTML/JSX
- **Auth bypasses**: Missing authentication or authorisation checks on protected routes
- **Path traversal**: User-controlled file paths without sanitisation
- **Data loss risk**: Destructive operations without confirmation or rollback path

### HIGH — Requires discussion before merge

- Functions exceeding 50 lines — split by responsibility
- Files exceeding 800 lines — extract modules
- Nesting deeper than 4 levels — use early returns or helper extraction
- Unhandled promise rejections or empty catch blocks
- Mutation patterns where immutable alternatives exist
- N+1 query patterns (fetching related data in a loop)
- Missing input validation at system boundaries
- `console.log` / debug statements left in production paths

### MEDIUM — Should fix, non-blocking

- Inefficient algorithms where a better complexity class is straightforward
- Missing memoisation for expensive repeated computations
- Unbounded queries (`SELECT *` or no `LIMIT`) on user-facing endpoints
- Missing loading/error states for async data fetching

### LOW — Suggestions

- Magic numbers without named constants
- Single-letter or ambiguous variable names in non-trivial contexts
- TODO/FIXME comments without linked issue numbers
- Missing JSDoc on exported public API functions

## Confidence Filter

Only report issues you are **>80% confident** are real problems. Do not:
- Flag stylistic preferences unless they violate project conventions
- Report issues in unchanged code unless CRITICAL
- List the same issue multiple times (consolidate: "4 functions missing error handling")

## Output Format

For each finding:

```
[CRITICAL] Hardcoded API token in source
File: src/api/client.ts:14
Issue: Token "sk-abc..." will be committed to git history and exposed.
Fix: Move to environment variable. Add to .env.example, not .env.

  const token = "sk-abc123";        // BAD
  const token = process.env.TOKEN;  // GOOD
```

End with a summary table:

```
## Review Summary

| Severity | Count | Status  |
|----------|-------|---------|
| CRITICAL | 0     | ✓ pass  |
| HIGH     | 2     | ⚠ warn  |
| MEDIUM   | 1     | ℹ info  |
| LOW      | 3     | · note  |

Verdict: WARNING — address HIGH issues before merging.
```

## Approval Criteria

- **Approve**: No CRITICAL or HIGH issues
- **Warn**: HIGH issues present — can merge with explicit team sign-off
- **Block**: Any CRITICAL issue — must fix before merge
