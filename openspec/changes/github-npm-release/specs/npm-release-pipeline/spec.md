## ADDED Requirements

### Requirement: Automated npm publish on version tag
The CI system SHALL automatically build and publish the npm package to GitHub Packages when a tag matching `v*` is pushed to the repository.

#### Scenario: Tag push triggers publish
- **WHEN** a git tag matching `v*` is pushed to the repository
- **THEN** the release workflow starts, runs tests and build, and publishes the package to `npm.pkg.github.com`

#### Scenario: Publish only on passing build
- **WHEN** the test or build step fails during a tag-triggered workflow run
- **THEN** the publish step SHALL NOT execute and the workflow run is marked as failed

#### Scenario: Manual workflow dispatch
- **WHEN** a repository maintainer triggers `workflow_dispatch` on the release workflow
- **THEN** the workflow runs the full build-test-publish pipeline using the current `HEAD`

### Requirement: GitHub Packages as the publish target
The package SHALL be published to the GitHub Packages npm registry (`npm.pkg.github.com`) scoped to the repository owner.

#### Scenario: Package installable after publish
- **WHEN** a version is successfully published
- **THEN** a user with `@<owner>:registry=https://npm.pkg.github.com` configured SHALL be able to install the package via `npm install @<owner>/ai-stash`

#### Scenario: Authentication via GITHUB_TOKEN
- **WHEN** the workflow publishes the package
- **THEN** authentication SHALL use the repository's built-in `GITHUB_TOKEN` with `packages: write` permission — no external token or secret is required

### Requirement: Package scoped to repository owner
The `package.json` `name` field SHALL be updated to a scoped name matching `@<owner>/ai-stash` and `publishConfig.registry` SHALL be set to `https://npm.pkg.github.com`.

#### Scenario: Scoped name in published package
- **WHEN** the package is published to GitHub Packages
- **THEN** it SHALL appear under the repository owner's scope and be addressable as `@<owner>/ai-stash`

#### Scenario: publishConfig present
- **WHEN** `npm publish` is executed
- **THEN** the `publishConfig.registry` field in `package.json` SHALL redirect the publish to `https://npm.pkg.github.com`

### Requirement: Workflow pipeline gates
The release workflow SHALL run steps in order: install dependencies → typecheck → test → build → publish; each step SHALL gate the next.

#### Scenario: Step failure halts pipeline
- **WHEN** any step before publish exits with a non-zero code
- **THEN** subsequent steps SHALL NOT run and the workflow run SHALL be marked as failed

#### Scenario: Frozen lockfile install
- **WHEN** the workflow installs dependencies
- **THEN** it SHALL use `pnpm install --frozen-lockfile` to ensure reproducible installs from `pnpm-lock.yaml`
