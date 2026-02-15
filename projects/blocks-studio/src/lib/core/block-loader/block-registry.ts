import type { Signal } from '@angular/core';

/**
 * Handle for a registered block: exposes instance (services/state by name) for ref resolution.
 */
export interface BlockInstanceHandle {
  /** Instance: services and state by name (e.g. FormState, value). */
  instance: Record<string, unknown>;
  /** Optional cleanup when block is destroyed. */
  destroy?: () => void;
}

/**
 * Registry of block instances by (full) id within a tree.
 * One registry per logical tree; duplicate id throws.
 */
export interface BlockRegistry {
  register(id: string, handle: BlockInstanceHandle): void;
  unregister(id: string): void;
  get(id: string): BlockInstanceHandle | undefined;
  has(id: string): boolean;
}

/**
 * Default in-memory BlockRegistry.
 */
export class BlockRegistryImpl implements BlockRegistry {
  private readonly map = new Map<string, BlockInstanceHandle>();

  register(id: string, handle: BlockInstanceHandle): void {
    if (this.map.has(id)) {
      throw new Error(`Block id "${id}" is already registered. Each id may only occur once per tree.`);
    }
    this.map.set(id, handle);
  }

  unregister(id: string): void {
    this.map.delete(id);
  }

  get(id: string): BlockInstanceHandle | undefined {
    return this.map.get(id);
  }

  has(id: string): boolean {
    return this.map.has(id);
  }
}
