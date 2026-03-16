import fs from 'node:fs';
import path from 'node:path';
import { getConfigDir } from './paths.js';
import { Config, DEFAULT_CONFIG } from './types.js';

export function loadConfig(): Config {
  const configDir = getConfigDir();
  const configPath = path.join(configDir, 'config.json');

  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { ...DEFAULT_CONFIG, ...parsed };
  }

  // Create config directory and default config file
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  return { ...DEFAULT_CONFIG };
}
