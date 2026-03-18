---
description: Generate a clear, structured pull request description from staged or recent git changes. Run before opening a PR to produce a reviewer-friendly summary.
allowed-tools: Bash, Read
---

# Write PR Description

Analyse the current branch's changes relative to the base branch and produce a complete pull request description.

## Steps

1. Run `git log main..HEAD --oneline` to list commits on this branch
2. Run `git diff main...HEAD --stat` to see files changed
3. Run `git diff main...HEAD` to read the full diff (or a representative sample for large diffs)
4. Read any relevant files for context if the diff alone is ambiguous

## Output Format

Produce a PR description in this exact structure:

---

## Summary

<!--
3–5 bullet points. Each bullet answers: "what changed and why?"
Lead with the most important change. Be specific — name files, functions, or behaviours.
Avoid: "fixed bug", "updated code", "made improvements"
-->

- **What**: [specific change] — **Why**: [reason / ticket reference]
- ...

## Type of Change

<!-- Check all that apply -->
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Refactor (no behaviour change)
- [ ] Performance improvement
- [ ] Documentation only
- [ ] Dependency update

## Test Plan

<!--
Describe how the change was tested. Be specific enough that a reviewer can reproduce.
-->

- [ ] [Step to test the primary change]
- [ ] [Edge case or error path tested]
- [ ] Existing test suite passes (`pnpm test` / `npm test`)

## Screenshots / Output

<!-- If this changes UI or CLI output, paste a before/after or a representative sample. Delete section if not applicable. -->

## Notes for Reviewer

<!-- Optional. Highlight tricky areas, design decisions, or things you'd like specific feedback on. -->

---

## Guidelines

- **Be specific**: "Extract `validateToken()` from `auth.ts` into `src/utils/token.ts`" beats "refactor auth"
- **Explain the why**: reviewers need context, not just a list of what changed
- **Surface trade-offs**: if you made a deliberate choice between approaches, say so in Notes
- **Keep it honest**: if something is incomplete or has known limitations, flag it explicitly
