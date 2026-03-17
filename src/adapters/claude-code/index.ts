import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Adapter, AssetType } from '../types.js';
import type { RegistryAsset } from '../../registry/types.js';
import type { InstalledAsset } from '../../lockfile/types.js';

export const claudeCodeAdapter: Adapter = {
  name: 'claude-code',

  getInstallPaths(asset: RegistryAsset, scope: 'project' | 'global', projectRoot: string): string[] {
    const assetType = asset.type as AssetType;
    const base = scope === 'global' ? path.join(os.homedir(), '.claude') : path.join(projectRoot, '.claude');

    switch (assetType) {
      case 'skill':
        return asset.files.map(f => path.join(base, 'skills', asset.name, path.basename(f)));
      case 'agent':
        return [path.join(base, 'agents', `${asset.name}.md`)];
      case 'instruction': {
        const instructionBase = scope === 'global' ? path.join(os.homedir(), '.claude') : projectRoot;
        return [path.join(instructionBase, 'CLAUDE.md')];
      }
      case 'hook':
        return [
          path.join(base, 'settings.json'),
          ...asset.files.filter(f => path.basename(f) !== 'hook-config.json').map(f => path.join(base, 'hooks', asset.name, path.basename(f))),
        ];
      case 'prompt':
        return [path.join(base, 'skills', asset.name, 'SKILL.md')];
      default:
        return [];
    }
  },

  transformFiles(asset: RegistryAsset, files: Record<string, string>): Record<string, string> {
    const assetType = asset.type as AssetType;

    switch (assetType) {
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
            // hook-config.json is used to merge into settings.json, not written directly
            continue;
          }
          result[filePath] = content;
        }
        return result;
      }
      case 'prompt': {
        const result: Record<string, string> = {};
        for (const [filePath, content] of Object.entries(files)) {
          result[filePath] = ensureDisableModelInvocation(content);
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

      if (assetType === 'instruction' && filePath.endsWith('CLAUDE.md')) {
        await removeInstructionBlock(fullPath, extractAssetName(asset, filePath));
        continue;
      }

      if (assetType === 'hook' && filePath.endsWith('settings.json')) {
        await removeHookEntries(fullPath, extractAssetName(asset, filePath));
        continue;
      }

      try {
        await fs.unlink(fullPath);
        // Try to remove parent directory if empty
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

  // Append if not present
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

function ensureDisableModelInvocation(content: string): string {
  if (content.startsWith('---')) {
    const endIdx = content.indexOf('---', 3);
    if (endIdx !== -1) {
      const frontmatter = content.substring(3, endIdx);
      if (!frontmatter.includes('disable-model-invocation')) {
        const updatedFrontmatter = frontmatter.trimEnd() + '\ndisable-model-invocation: true\n';
        return '---' + updatedFrontmatter + content.substring(endIdx);
      }
      return content;
    }
  }
  // No frontmatter — add it
  return '---\ndisable-model-invocation: true\n---\n' + content;
}

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
    const settings = JSON.parse(content) as Record<string, unknown>;
    const hooks = (settings.hooks ?? []) as Array<Record<string, unknown>>;
    settings.hooks = hooks.filter(h => h.name !== assetName);
    await fs.writeFile(filePath, JSON.stringify(settings, null, 2) + '\n');
  } catch {
    // File may not exist
  }
}

function extractAssetName(asset: InstalledAsset, _filePath: string): string {
  // The asset name is derived from the installed asset's key in the lockfile.
  // For now, we extract it from the files list pattern.
  // In the lockfile, the key is the asset name, but InstalledAsset doesn't carry it.
  // We'll use the directory name from the files list as a heuristic.
  for (const f of asset.files) {
    const match = f.match(/skills\/([^/]+)\//);
    if (match) return match[1];
    const agentMatch = f.match(/agents\/([^/]+)\.md$/);
    if (agentMatch) return agentMatch[1];
    const hookMatch = f.match(/hooks\/([^/]+)\//);
    if (hookMatch) return hookMatch[1];
  }
  return 'unknown';
}
