const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
if (nodeVersion < 18) {
  console.error(`ai-stash requires Node.js >= 18. You are running Node.js ${process.versions.node}.`);
  process.exit(1);
}

import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';

render(<App />);
