import type { Adapter } from './types.js';

const adapters = new Map<string, Adapter>();

export function registerAdapter(adapter: Adapter): void {
  adapters.set(adapter.name, adapter);
}

export function getAdapter(name: string): Adapter | undefined {
  return adapters.get(name);
}

export function listAdapters(): Adapter[] {
  return Array.from(adapters.values());
}
