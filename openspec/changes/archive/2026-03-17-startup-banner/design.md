## Context

`src/cli.tsx` currently renders `<App />` immediately. There is no intro screen. The stack is React + Ink (terminal UI) with `ink-spinner` already available. Version is in `package.json`.

## Goals / Non-Goals

**Goals:**
- Render a banner for ~1.5s at startup before transitioning to `App`
- Show ASCII logo, version number, and one-line tool description
- Simple fade-in / typewriter animation using Ink primitives
- Skip or shorten banner when stdout is not a TTY (CI, pipe, `--no-banner` flag future-proofing)

**Non-Goals:**
- Persistent header in the main TUI (banner is ephemeral)
- Network calls or async data during the banner
- Configurable animation speed (fixed timing is fine for now)

## Decisions

### Decision 1: Animation approach — `useEffect` + `useState` interval

Ink has no built-in animation primitives beyond `ink-spinner`. The simplest approach is a `useEffect` timer that advances a frame counter, driving character-reveal or opacity-style effects via conditional rendering.

**Chosen:** Reveal the description text character by character (typewriter effect) over 800ms, then hold for 500ms, then call `onDone()`.

```
t=0ms     logo + version appear instantly
t=0-800ms description text types in (character reveal)
t=800ms   full banner visible
t=1300ms  onDone() fires → App mounts
```

**Alternative considered:** CSS-style fade — not possible in terminal rendering. `ink-spinner` animation while text loads — doesn't convey content progressively. Static render with timed unmount — no animation value.

---

### Decision 2: Version injection — import `package.json` directly

Node 22 + TypeScript `resolveJsonModule` allows `import pkg from '../../package.json'`. This is zero-overhead (bundled at build time) and doesn't require any env var or build script change.

**Chosen:** `import pkg from '../../package.json' assert { type: 'json' }` (or `with { type: 'json' }` for Node 22). Fall back to `'0.0.0'` if unavailable.

**Alternative considered:** Pass version as a prop from `cli.tsx` — adds coupling. Read `package.json` at runtime with `fs.readFileSync` — unnecessary I/O.

---

### Decision 3: Banner mounting in `cli.tsx` — conditional render with `showBanner` flag

`cli.tsx` holds a `showBanner` state. When `true`, it renders `<Banner onDone={() => setShowBanner(false)} />`. When `false`, it renders `<App />`. Clean separation — `Banner` is fully self-contained.

**Alternative considered:** Render banner inside `App` — mixes concerns. Render both simultaneously — terminal flicker on unmount.

---

### Decision 4: ASCII logo design

Keep it narrow (≤60 chars wide) to fit standard 80-col terminals. Use block characters or simple ASCII.

```
  ╔═══════════════════════════════╗
  ║   ██████╗ ██╗    ███████╗    ║
  ║  ██╔══██╗██║     ██╔════╝    ║
  ║  ███████║██║     ███████╗    ║
  ║  ██╔══██║██║          ██║    ║
  ║  ██║  ██║███████╗███████║    ║
  ║  ╚═╝  ╚═╝╚══════╝╚══════╝   ║
  ║         ai-stash             ║
  ╚═══════════════════════════════╝
```

Simpler alternative (chosen for maintainability):

```
    ██████╗ ██╗      ███████╗████████╗ █████╗ ███████╗██╗  ██╗
   ██╔══██╗██║      ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║  ██║
   ███████║██║█████╗███████╗   ██║   ███████║███████╗███████║
   ██╔══██║██║╚════╝╚════██║   ██║   ██╔══██║╚════██║██╔══██║
   ██║  ██║██║      ███████║   ██║   ██║  ██║███████║██║  ██║
   ╚═╝  ╚═╝╚═╝      ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
```

Use the simpler word "ai-stash" in bold cyan as a fallback if box-drawing chars don't render.

## Risks / Trade-offs

**Risk:** Terminal doesn't support box-drawing characters → **Mitigation:** Plain text fallback; logo is purely cosmetic, no functional impact.

**Risk:** 1.3s delay annoys power users → **Mitigation:** Check `process.env.CI` or `!process.stdout.isTTY` and skip banner entirely in non-interactive contexts.

**Risk:** `import ... assert { type: 'json' }` syntax varies across Node versions → **Mitigation:** Use `createRequire` from `module` as a fallback; hardcode version string as last resort.
