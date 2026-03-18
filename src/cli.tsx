const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
if (nodeVersion < 18) {
  console.error(`ai-stash requires Node.js >= 18. You are running Node.js ${process.versions.node}.`);
  process.exit(1);
}

// Dynamic imports ensure the version check above runs before any module code executes
const { render } = await import('ink');
const { App } = await import('./ui/App.js');
const { printBanner } = await import('./ui/components/Banner.js');

if (process.stdout.isTTY) {
  await printBanner();
}

render(<App />);
