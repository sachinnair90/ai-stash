## 1. Banner Component

- [ ] 1.1 Create `src/ui/components/Banner.tsx` — accepts `onDone: () => void` prop
- [ ] 1.2 Import version and description from `package.json` using `createRequire` or JSON import
- [ ] 1.3 Define the ASCII logo string constant inside the component
- [ ] 1.4 Implement typewriter effect: `useEffect` with `setInterval` that increments a `charCount` state every ~(800ms / description.length)ms until fully revealed
- [ ] 1.5 After description is fully revealed, set a 500ms `setTimeout` then call `onDone()`
- [ ] 1.6 Render: logo (bold cyan), version (dimColor), animated description slice (`description.slice(0, charCount)`) with a blinking cursor while typing

## 2. CLI Entry Point

- [ ] 2.1 In `src/cli.tsx`, add `showBanner` state (default `true` when `process.stdout.isTTY`, else `false`)
- [ ] 2.2 Conditionally render `<Banner onDone={() => setShowBanner(false)} />` or `<App />` based on `showBanner`

## 3. Verification

- [ ] 3.1 Run `pnpm run dev` and visually confirm: logo appears, description types in, transitions to main TUI
- [ ] 3.2 Run `pnpm typecheck` — no errors
- [ ] 3.3 Run `pnpm test` — all tests pass
