import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getConfigDir } from './paths.js';
import { Config, DEFAULT_CONFIG } from './types.js';

function resolveGithubToken(): string | undefined {
  if (process.env['GITHUB_TOKEN']) return process.env['GITHUB_TOKEN'];

  // Try GitHub CLI
  try {
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf-8' }).trim();
    if (token) return token;
  } catch { /* gh not installed or not authenticated */ }

  // Try git credential manager
  try {
    const out = execFileSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf-8',
    });
    const match = /^password=(.+)$/m.exec(out);
    if (match?.[1]) return match[1].trim();
  } catch { /* no git credentials stored */ }

  return undefined;
}

export function loadConfig(): Config {
  const configDir = getConfigDir();
  const configPath = path.join(configDir, 'config.json');

  let config: Config;
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    let parsed: Partial<Config>;
    try {
      parsed = JSON.parse(raw) as Partial<Config>;
    } catch {
      console.warn('ai-stash: config.json is invalid JSON, falling back to defaults');
      parsed = {};
    }
    config = {
      ...DEFAULT_CONFIG,
      ...parsed,
      registry: { ...DEFAULT_CONFIG.registry, ...parsed.registry },
    };
  } else {
    // Create config directory and default config file
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    config = { ...DEFAULT_CONFIG };
  }

  if (process.env['REGISTRY_URL']) {
    config.registry = { ...config.registry, url: process.env['REGISTRY_URL'] };
  }

  config.githubToken = config.githubToken ?? resolveGithubToken();

  return config;
}
