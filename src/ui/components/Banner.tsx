import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../../../package.json') as { version: string; description: string };

const VERSION = pkg.version;
const DESCRIPTION = pkg.description;

const LOGO = [
  '   █████████   █████             █████████  ███████████   █████████    █████████  █████   █████',
  '  ███▒▒▒▒▒███ ▒▒███             ███▒▒▒▒▒███▒█▒▒▒███▒▒▒█  ███▒▒▒▒▒███  ███▒▒▒▒▒███▒▒███   ▒▒███',
  ' ▒███    ▒███  ▒███            ▒███    ▒▒▒ ▒   ▒███  ▒  ▒███    ▒███ ▒███    ▒▒▒  ▒███    ▒███',
  ' ▒███████████  ▒███  ██████████▒▒█████████     ▒███     ▒███████████ ▒▒█████████  ▒███████████',
  ' ▒███▒▒▒▒▒███  ▒███ ▒▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒███    ▒███     ▒███▒▒▒▒▒███  ▒▒▒▒▒▒▒▒███ ▒███▒▒▒▒▒███',
  ' ▒███    ▒███  ▒███             ███    ▒███    ▒███     ▒███    ▒███  ███    ▒███ ▒███    ▒███',
  ' █████   █████ █████           ▒▒█████████     █████    █████   █████▒▒█████████  █████   █████',
  '▒▒▒▒▒   ▒▒▒▒▒ ▒▒▒▒▒             ▒▒▒▒▒▒▒▒▒     ▒▒▒▒▒    ▒▒▒▒▒   ▒▒▒▒▒  ▒▒▒▒▒▒▒▒▒  ▒▒▒▒▒   ▒▒▒▒▒',
];

const CYAN_BOLD = '\x1b[1;36m';
const DIM      = '\x1b[2m';
const RESET    = '\x1b[0m';
const CYAN     = '\x1b[36m';
const TYPING_DURATION_MS = 800;
const HOLD_DURATION_MS   = 500;

export async function printBanner(): Promise<void> {
  const out = process.stdout;

  out.write('\n');
  for (const line of LOGO) {
    out.write(CYAN_BOLD + line + RESET + '\n');
  }
  out.write(DIM + 'v' + VERSION + RESET + '\n');

  // Typewriter animation for description
  if (DESCRIPTION.length === 0) {
    await new Promise<void>(resolve => setTimeout(resolve, HOLD_DURATION_MS));
    out.write('\n\n');
    return;
  }
  const intervalMs = Math.max(16, Math.floor(TYPING_DURATION_MS / DESCRIPTION.length));
  await new Promise<void>(resolve => {
    let charCount = 0;
    const tick = setInterval(() => {
      charCount++;
      const text = DESCRIPTION.slice(0, charCount);
      const cursor = charCount < DESCRIPTION.length ? CYAN + '▌' + RESET : '  ';
      out.write('\r' + text + cursor);
      if (charCount >= DESCRIPTION.length) {
        clearInterval(tick);
        setTimeout(() => {
          out.write('\n\n');
          resolve();
        }, HOLD_DURATION_MS);
      }
    }, intervalMs);
  });
}
