const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);
if (nodeVersion < 18) {
  console.error(`ai-stash requires Node.js >= 18. You are running Node.js ${process.versions.node}.`);
  process.exit(1);
}

import React, { useState } from 'react';
import { Box, render } from 'ink';
import { App } from './ui/App.js';
import { Banner } from './ui/components/Banner.js';

const isTTY = Boolean(process.stdout.isTTY);

function Root() {
  const [bannerDone, setBannerDone] = useState(false);

  return (
    <Box flexDirection="column" width="100%">
      {isTTY && <Banner onDone={() => setBannerDone(true)} />}
      {(!isTTY || bannerDone) && <App />}
    </Box>
  );
}

render(<Root />);
