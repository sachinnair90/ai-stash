import * as fs from 'node:fs/promises';
import fsSync from 'node:fs';
import * as path from 'node:path';
import type { Adapter, AssetType } from '../types.js';
import type { RegistryAsset } from '../../registry/types.js';
import type { InstalledAsset } from '../../lockfile/types.js';

export const copilotAdapter: Adapter = {
  name: 'copilot',

  getInstallPaths(asset: RegistryAsset, scope: 'project' | 'global', projectRoot: string): string[] {
    const assetType = asset.type as AssetType;
    const base = path.join(projectRoot, '.github');

    // Copilot doesn't really have a "global" scope — always project-scoped
    void scope;

    switch (assetType) {
      case 'skill':
        return asset.files.map(f => path.join(base, 'skills', asset.name, path.basename(f)));
      case 'agent':
        return [path.join(base, 'agents', `${asset.name}.md`)];
      case 'instruction': {
        const agentsMd = path.join(projectRoot, 'AGENTS.md');
        const copilotInstructions = path.join(projectRoot, '.github', 'copilot-instructions.md');
        if (!fsSync.existsSync(agentsMd) && fsSync.existsSync(copilotInstructions)) {
          return [copilotInstructions];
        }
        return [agentsMd];
      }
      case 'hook':
        return [path.join(base, 'hooks', 'hooks.json')];
      case 'prompt':
        return [path.join(base, 'prompts', `${asset.name}.prompt.md`)];
      default:
        return [];
    }
  },

  transformFiles(asset: RegistryAsset, files: Record<string, string>): Record<string, string> {
    const assetType = asset.type as AssetType;

    switch (assetType) {
      case 'agent': {
        const result: Record<string, string> = {};
        for (const [filePath, content] of Object.entries(files)) {
          result[filePath] = transformAgentFrontmatter(content);
        }
        return result;
      }
      case 'instruction': {
        const result: Record<string, string> = {};
        for (const [filePath, content] of Object.entries(files)) {
          result[filePath] = wrapInSectionMarkers(asset.name, content);
        }
        return result;
      }
      case 'hook': {
        const result: Record<string, string> = {};
        for (const [filePath, content] of Object.entries(files)) {
          if (filePath.endsWith('hook-config.json')) {
            result[filePath] = transformHookConfig(content);
          } else {
            result[filePath] = content;
          }
        }
        return result;
      }
      case 'prompt': {
        const result: Record<string, string> = {};
        for (const [filePath, content] of Object.entries(files)) {
          result[filePath] = transformPrompt(content);
        }
        return result;
      }
      default:
        return files;
    }
  },

  mergeIntoExisting(assetName: string, existing: string, incoming: string, assetType: AssetType): string {
    switch (assetType) {
      case 'instruction':
        return mergeInstruction(assetName, existing, incoming);
      case 'hook':
        return mergeHooks(existing, incoming);
      default:
        return incoming;
    }
  },

  async removeAsset(asset: InstalledAsset, projectRoot: string): Promise<void> {
    const assetType = asset.type as AssetType;

    for (const filePath of asset.files) {
      const fullPath = path.resolve(projectRoot, filePath);

      if (assetType === 'instruction' && filePath.endsWith('AGENTS.md')) {
        await removeInstructionBlock(fullPath, extractAssetName(asset));
        continue;
      }

      if (assetType === 'hook' && filePath.endsWith('hooks.json')) {
        await removeHookEntries(fullPath, extractAssetName(asset));
        continue;
      }

      try {
        await fs.unlink(fullPath);
        const dir = path.dirname(fullPath);
        const entries = await fs.readdir(dir);
        if (entries.length === 0) {
          await fs.rmdir(dir);
        }
      } catch {
        // File may already be deleted
      }
    }
  },
};

// --- Frontmatter parsing helpers ---

interface ParsedFrontmatter {
  fields: Record<string, string>;
  body: string;
}

function parseFrontmatter(content: string): ParsedFrontmatter {
  if (!content.startsWith('---')) {
    return { fields: {}, body: content };
  }
  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) {
    return { fields: {}, body: content };
  }
  const raw = content.substring(3, endIdx).trim();
  const body = content.substring(endIdx + 3).replace(/^\n/, '');
  const fields: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      fields[key] = value;
    }
  }
  return { fields, body };
}

function serializeFrontmatter(fields: Record<string, string>, body: string): string {
  const entries = Object.entries(fields);
  if (entries.length === 0) return body;
  const yaml = entries.map(([k, v]) => `${k}: ${v}`).join('\n');
  return `---\n${yaml}\n---\n${body}`;
}

// --- Transform helpers ---

const CLAUDE_SPECIFIC_FIELDS = new Set([
  'permissionMode', 'maxTurns', 'skills', 'hooks', 'memory', 'background', 'isolation', 'model', 'disallowedTools',
]);

function transformAgentFrontmatter(content: string): string {
  const { fields, body } = parseFrontmatter(content);
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!CLAUDE_SPECIFIC_FIELDS.has(key)) {
      filtered[key] = value;
    }
  }
  return serializeFrontmatter(filtered, body);
}

const EVENT_NAME_MAP: Record<string, string> = {
  PreToolUse: 'preToolUse',
  PostToolUse: 'postToolUse',
};

function transformHookConfig(content: string): string {
  const config = JSON.parse(content) as Record<string, unknown>;
  const hooks = (config.hooks ?? []) as Array<Record<string, unknown>>;

  const transformed = hooks.map(hook => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(hook)) {
      if (key === 'event' && typeof value === 'string') {
        result.event = EVENT_NAME_MAP[value] ?? value;
      } else if (key === 'command') {
        result.bash = value;
      } else {
        result[key] = value;
      }
    }
    return result;
  });

  return JSON.stringify({ ...config, hooks: transformed }, null, 2);
}

function transformPrompt(content: string): string {
  const { fields, body } = parseFrontmatter(content);
  const transformedBody = body
    .replace(/\$ARGUMENTS/g, '${input:args}')
    .replace(/\$0\b/g, '${input:arg0}');
  return serializeFrontmatter(fields, transformedBody);
}

// --- Section markers ---

function wrapInSectionMarkers(name: string, content: string): string {
  return `<!-- ai-stash:${name} -->\n${content}\n<!-- /ai-stash:${name} -->`;
}

function mergeInstruction(assetName: string, existing: string, incoming: string): string {
  const startMarker = `<!-- ai-stash:${assetName} -->`;
  const endMarker = `<!-- /ai-stash:${assetName} -->`;
  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    return existing.substring(0, startIdx) + incoming + existing.substring(endIdx + endMarker.length);
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return existing + separator + incoming;
}

function mergeHooks(existingJson: string, incomingJson: string): string {
  const existing = JSON.parse(existingJson || '{}') as Record<string, unknown>;
  const incoming = JSON.parse(incomingJson) as Record<string, unknown>;

  const existingHooks = (existing.hooks ?? []) as Array<Record<string, unknown>>;
  const incomingHooks = (incoming.hooks ?? []) as Array<Record<string, unknown>>;

  for (const hook of incomingHooks) {
    const idx = existingHooks.findIndex(h => h.name === hook.name);
    if (idx !== -1) {
      existingHooks[idx] = hook;
    } else {
      existingHooks.push(hook);
    }
  }

  existing.hooks = existingHooks;
  return JSON.stringify(existing, null, 2);
}

// --- Remove helpers ---

async function removeInstructionBlock(filePath: string, assetName: string): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const startMarker = `<!-- ai-stash:${assetName} -->`;
    const endMarker = `<!-- /ai-stash:${assetName} -->`;
    const startIdx = content.indexOf(startMarker);
    const endIdx = content.indexOf(endMarker);

    if (startIdx !== -1 && endIdx !== -1) {
      const before = content.substring(0, startIdx);
      const after = content.substring(endIdx + endMarker.length);
      const cleaned = (before + after).replace(/\n{3,}/g, '\n\n').trim();
      await fs.writeFile(filePath, cleaned + '\n');
    }
  } catch {
    // File may not exist
  }
}

async function removeHookEntries(filePath: string, assetName: string): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const config = JSON.parse(content) as Record<string, unknown>;
    const hooks = (config.hooks ?? []) as Array<Record<string, unknown>>;
    config.hooks = hooks.filter(h => h.name !== assetName);
    await fs.writeFile(filePath, JSON.stringify(config, null, 2) + '\n');
  } catch {
    // File may not exist
  }
}

function extractAssetName(asset: InstalledAsset): string {
  for (const f of asset.files) {
    const match = f.match(/skills\/([^/]+)\//) ??
      f.match(/agents\/([^/]+)\.md$/) ??
      f.match(/hooks\/([^/]+)\//) ??
      f.match(/prompts\/([^/]+)\.prompt\.md$/);
    if (match) return match[1];
  }
  return 'unknown';
}
