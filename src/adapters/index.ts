export { registerAdapter, getAdapter, listAdapters } from './registry.js';
export type { Adapter, AssetType } from './types.js';

import { registerAdapter } from './registry.js';
import { claudeCodeAdapter } from './claude-code/index.js';
import { copilotAdapter } from './copilot/index.js';

registerAdapter(claudeCodeAdapter);
registerAdapter(copilotAdapter);
