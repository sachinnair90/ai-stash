const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
if (nodeVersion < 18) {
  console.error(`ai-stash requires Node.js >= 18. You are running Node.js ${process.versions.node}.`);
  process.exit(1);
}

// Handle registry subcommands before rendering TUI
const args = process.argv.slice(2);
if (args[0] === 'registry') {
  const { handleRegistryCommand } = await import('./commands/registry.js');
  handleRegistryCommand(args.slice(1));
  process.exit(0);
}

// Dynamic imports ensure the version check above runs before any module code executes
const { render } = await import('ink');
const { App } = await import('./ui/App.js');
const { printBanner } = await import('./ui/components/Banner.js');

if (process.stdout.isTTY) {
  await printBanner();
}

render(<App />);
