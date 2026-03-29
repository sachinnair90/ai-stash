## Context

`ai-stash` is a TypeScript CLI tool (compiled to `dist/`) distributed as a Node.js package with a binary entry. Currently there is no release automation — no GitHub Actions, no publish workflow, and therefore no installable npm artifact. Users must clone and build manually. The package uses `pnpm` as its package manager.

GitHub Packages provides an npm-compatible registry hosted at `npm.pkg.github.com`. Packages published there are installable via `npm install @<owner>/<package>` once the consumer configures the registry scope. Since the repo already lives on GitHub, this avoids any additional external service.

## Goals / Non-Goals

**Goals:**
- Automatically build, test, and publish the package to GitHub Packages on every version tag push (`v*`)
- Use the built-in `GITHUB_TOKEN` — no external npm token or secret management
- Ensure the publish step only runs if tests and build pass
- Allow manual trigger (`workflow_dispatch`) for ad-hoc publishes

**Non-Goals:**
- Publishing to the public npmjs.com registry (out of scope; different auth model)
- Automated version bumping or changelog generation
- Semantic-release or changesets integration
- Docker or container publishing

## Decisions

### Decision: GitHub Packages over npmjs.com
GitHub Packages npm registry is used rather than the public npmjs.com registry.

**Rationale**: The user explicitly requested "via npm using github". GitHub Packages requires zero external secrets — the workflow uses the auto-provisioned `GITHUB_TOKEN` with `packages: write` permission. This keeps the entire release pipeline self-contained in the repository with no third-party account required.

**Alternative considered**: Publishing to npmjs.com — requires a separate `NPM_TOKEN` secret and a registered npm account. Better for maximum discoverability but adds operational overhead.

### Decision: Trigger on `v*` tag push + `workflow_dispatch`
The workflow triggers on pushes matching `refs/tags/v*` and also supports manual dispatch.

**Rationale**: Tag-based releases are the standard GitHub pattern. Manual dispatch allows re-running without extra commits. A release event trigger was considered but adds an extra UI step (creating a GitHub Release) before the package is available.

### Decision: Scoped package name `@<owner>/ai-stash`
`package.json` `name` field is updated to `@<github-org-or-user>/ai-stash` and `publishConfig.registry` is added.

**Rationale**: GitHub Packages requires all packages to be scoped to match the repository owner. This is a **non-breaking change** for CLI users who install via `npx` (they update the run command) but is a breaking change for anyone who `npm install`-ed the unscoped name (currently no published version exists, so no existing consumers).

### Decision: pnpm for install, standard `npm publish` for release
CI uses `pnpm install --frozen-lockfile` (faithful to the project's package manager) but publishes with the auto-configured `npm` (set up by `actions/setup-node`).

**Rationale**: `pnpm publish` works but `setup-node`'s `.npmrc` injection is designed for `npm`. Using npm for the publish step avoids pnpm version mismatches in CI without affecting local development.

## Risks / Trade-offs

- **[Risk] Consumers must configure registry scope** → GitHub Packages packages require the consumer to add `@<owner>:registry=https://npm.pkg.github.com` to their `.npmrc`. This is a discovery/UX friction compared to npmjs.com. **Mitigation**: Document in README.
- **[Risk] Package scope ties to GitHub org/user** → Renaming the repo or org breaks existing installs. **Mitigation**: Accept this; document the install command clearly.
- **[Risk] `GITHUB_TOKEN` visibility** → By default, packages created from private repositories inherit private visibility. **Mitigation**: For public repos this is fine; document that the package visibility matches the repo.
- **[Trade-off] `package.json` name change** → No published package currently exists, so no migration is needed today. If a future npm publish exists, this is a breaking change.
