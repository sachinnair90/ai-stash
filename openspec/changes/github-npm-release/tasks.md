## 1. Update package.json

- [x] 1.1 Change `name` field from `"ai-stash"` to `"@<owner>/ai-stash"` (replace `<owner>` with the actual GitHub org/user)
- [x] 1.2 Add `"publishConfig": { "registry": "https://npm.pkg.github.com" }` to `package.json`

## 2. Create GitHub Actions release workflow

- [x] 2.1 Create `.github/workflows/release.yml` with triggers: `push` on `tags: ['v*']` and `workflow_dispatch`
- [x] 2.2 Add `permissions: contents: read, packages: write` at the workflow level
- [x] 2.3 Add a `release` job with `runs-on: ubuntu-latest`
- [x] 2.4 Add step: checkout code with `actions/checkout@v4`
- [x] 2.5 Add step: setup pnpm with `pnpm/action-setup@v4` (version matching `package.json` `engines` or latest)
- [x] 2.6 Add step: setup Node.js with `actions/setup-node@v4`, `node-version: '20'`, `registry-url: 'https://npm.pkg.github.com'`, and `cache: 'pnpm'`
- [x] 2.7 Add step: `pnpm install --frozen-lockfile`
- [x] 2.8 Add step: `pnpm run typecheck`
- [x] 2.9 Add step: `pnpm run test`
- [x] 2.10 Add step: `pnpm run build`
- [x] 2.11 Add step: `npm publish` with `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` as an env var

## 3. Update README

- [x] 3.1 Add an "Installation" section documenting the `.npmrc` scope configuration (`@<owner>:registry=https://npm.pkg.github.com`)
- [x] 3.2 Document the install command: `npm install @<owner>/ai-stash` and `npx @<owner>/ai-stash`
- [x] 3.3 Add a preview/pre-stable banner at the very top of `README.md` (e.g., `> **⚠️ Preview:** This tool is under active development. Breaking changes may occur until a stable release (v1.0.0) is tagged.`)
- [x] 3.4 Add a GitHub Actions CI status badge pointing to the `release.yml` workflow
- [x] 3.5 Add a GitHub Packages version badge (using `https://img.shields.io/github/v/release/<owner>/ai-stash` or similar)

## 4. Audit README against implementation

- [x] 4.1 Read through `README.md` and cross-check every documented command, flag, and feature against the current source in `src/`
- [x] 4.2 Remove or update any sections that reference features not yet implemented or that have changed behavior
- [x] 4.3 Add entries for any implemented features or commands not yet documented in the README

## 5. Verify end-to-end

- [ ] 5.1 Push a test tag (e.g., `v0.1.0`) to the repository and confirm the workflow runs successfully in the Actions tab
- [ ] 5.2 Confirm the package appears under the repository's "Packages" section on GitHub
- [ ] 5.3 Test installation: configure `.npmrc` with the scope and run `npm install @<owner>/ai-stash` in a fresh directory
- [ ] 5.4 Confirm the CI badge and version badge render correctly on the GitHub repository README page
