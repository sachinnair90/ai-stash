## Why

There is no automated release pipeline, meaning built packages are never published and users cannot install `ai-stash` via npm or GitHub Packages. An automated workflow removes the manual build-and-publish step and makes every tagged release immediately installable.

## What Changes

- Add `.github/workflows/release.yml` — triggers on `v*` tags, runs tests, builds, and publishes to GitHub Packages (npm registry)
- Update `package.json` `name` to a scoped package name (`@<owner>/ai-stash`) required by GitHub Packages
- Add `publishConfig` to `package.json` pointing to `https://npm.pkg.github.com`
- Update `README.md` with a **preview/pre-stable banner** warning developers of potential breaking changes until a stable release is tagged
- Update `README.md` with **CI status badge** (GitHub Actions workflow) and **version badge** (GitHub Packages latest)
- Audit `README.md` against current implementation to close any documentation drift

## Capabilities

### New Capabilities

- `npm-release-pipeline`: GitHub Actions workflow that builds, tests, and publishes the npm package to GitHub Packages on version tag pushes, enabling `npm install @<owner>/ai-stash` installation

### Modified Capabilities

<!-- none -->

## Impact

- `.github/workflows/release.yml` — new file
- `package.json` — name + publishConfig fields updated
- `README.md` — preview banner added at top; CI and version badges added; content audited against current feature set
- Consumers install via `npm install @<owner>/ai-stash` (or `npx @<owner>/ai-stash`) instead of building locally
- Requires a `NODE_AUTH_TOKEN` Actions secret and write access to packages in the repository settings
