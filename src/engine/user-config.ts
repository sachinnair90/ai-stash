import readline from 'node:readline';
import type { UserConfigEntry } from '../registry/types.js';
import { storeCredential, getCredential } from '../config/credentials.js';
import { storeUserConfig as storeNonSensitive, getUserConfig as getNonSensitive } from '../config/user-settings.js';

export interface CollectedConfig {
  /** All collected values (sensitive and non-sensitive) */
  all: Record<string, string>;
  /** Only non-sensitive values (safe for file substitution) */
  nonSensitive: Record<string, string>;
}

/**
 * Collect userConfig values for an asset. Prompts only for keys not already stored.
 * Headless (readline) collection path for CLI mode.
 */
export async function collectUserConfig(
  assetName: string,
  userConfig: Record<string, UserConfigEntry>,
  existingKeys?: Set<string>,
): Promise<CollectedConfig> {
  const all: Record<string, string> = {};
  const nonSensitive: Record<string, string> = {};

  for (const [key, entry] of Object.entries(userConfig)) {
    if (existingKeys?.has(key)) {
      // Load existing value
      if (entry.sensitive) {
        const stored = await getCredential(assetName, key);
        if (stored) {
          all[key] = stored;
          continue;
        }
      } else {
        const stored = getNonSensitive(assetName, key);
        if (stored) {
          all[key] = stored;
          nonSensitive[key] = stored;
          continue;
        }
      }
    }

    // Check if already stored before prompting
    if (entry.sensitive) {
      const stored = await getCredential(assetName, key);
      if (stored) {
        all[key] = stored;
        continue;
      }
    } else {
      const stored = getNonSensitive(assetName, key);
      if (stored) {
        all[key] = stored;
        nonSensitive[key] = stored;
        continue;
      }
    }

    // Prompt user
    const value = await promptValue(key, entry);

    // Store the value
    if (entry.sensitive) {
      await storeCredential(assetName, key, value);
    } else {
      storeNonSensitive(assetName, key, value);
      nonSensitive[key] = value;
    }
    all[key] = value;
  }

  return { all, nonSensitive };
}

async function promptValue(key: string, entry: UserConfigEntry): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  const sensitiveLabel = entry.sensitive ? ' (sensitive - input hidden)' : '';
  const prompt = `${entry.description} [${key}]${sensitiveLabel}: `;

  return new Promise<string>((resolve) => {
    if (entry.sensitive && process.stdin.isTTY) {
      // Mask input for sensitive values
      process.stderr.write(prompt);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      stdin.setRawMode(true);
      stdin.resume();

      let value = '';
      const onData = (ch: Buffer) => {
        const c = ch.toString('utf-8');
        if (c === '\n' || c === '\r') {
          stdin.setRawMode(wasRaw ?? false);
          stdin.removeListener('data', onData);
          process.stderr.write('\n');
          rl.close();
          resolve(value);
        } else if (c === '\u007F' || c === '\b') {
          // Backspace
          value = value.slice(0, -1);
        } else if (c === '\u0003') {
          // Ctrl+C
          rl.close();
          process.exit(1);
        } else {
          value += c;
        }
      };
      stdin.on('data', onData);
    } else {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

/**
 * Replace ${user_config.<key>} placeholders in file content with non-sensitive values.
 * Sensitive keys are left as-is (never substituted into files).
 */
export function substituteUserConfig(
  content: string,
  nonSensitiveValues: Record<string, string>,
): string {
  return content.replace(/\$\{user_config\.([^}]+)\}/g, (match, key: string) => {
    if (key in nonSensitiveValues) {
      return nonSensitiveValues[key];
    }
    // Unknown or sensitive key — leave as-is
    return match;
  });
}
