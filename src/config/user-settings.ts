import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function getConfigDir(): string {
  const base = process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
  return path.join(base, 'ai-stash');
}

function getSettingsPath(): string {
  return path.join(getConfigDir(), 'settings.json');
}

interface SettingsData {
  userConfig?: Record<string, Record<string, string>>;
}

function readSettings(): SettingsData {
  const filePath = getSettingsPath();
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as SettingsData;
}

function writeSettings(data: SettingsData): void {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(data, null, 2), 'utf-8');
}

export function storeUserConfig(assetName: string, key: string, value: string): void {
  const data = readSettings();
  if (!data.userConfig) data.userConfig = {};
  if (!data.userConfig[assetName]) data.userConfig[assetName] = {};
  data.userConfig[assetName][key] = value;
  writeSettings(data);
}

export function getUserConfig(assetName: string, key: string): string | null {
  const data = readSettings();
  return data.userConfig?.[assetName]?.[key] ?? null;
}
