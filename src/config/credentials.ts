import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SERVICE_NAME = 'ai-stash';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let keytarModule: any = null;
let keytarChecked = false;
let infoEmitted = false;

function getConfigDir(): string {
  const base = process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
  return path.join(base, 'ai-stash');
}

function getCredentialsPath(): string {
  return path.join(getConfigDir(), 'credentials.json');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadKeytar(): any {
  if (keytarChecked) return keytarModule;
  keytarChecked = true;
  try {
    keytarModule = require('keytar');
  } catch {
    if (!infoEmitted) {
      infoEmitted = true;
      console.info('ai-stash: OS keychain unavailable, using credentials file as fallback.');
    }
    keytarModule = null;
  }
  return keytarModule;
}

function readCredentialsFile(): Record<string, string> {
  const filePath = getCredentialsPath();
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Record<string, string>;
}

function writeCredentialsFile(data: Record<string, string>): void {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = getCredentialsPath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function credentialKey(assetName: string, key: string): string {
  return `${assetName}/${key}`;
}

export async function storeCredential(assetName: string, key: string, value: string): Promise<void> {
  const keytar = loadKeytar();
  if (keytar) {
    await keytar.setPassword(SERVICE_NAME, credentialKey(assetName, key), value);
    return;
  }
  // Fallback to credentials file
  const data = readCredentialsFile();
  data[credentialKey(assetName, key)] = value;
  writeCredentialsFile(data);
}

export async function getCredential(assetName: string, key: string): Promise<string | null> {
  const keytar = loadKeytar();
  if (keytar) {
    return keytar.getPassword(SERVICE_NAME, credentialKey(assetName, key));
  }
  // Fallback to credentials file
  const data = readCredentialsFile();
  return data[credentialKey(assetName, key)] ?? null;
}
