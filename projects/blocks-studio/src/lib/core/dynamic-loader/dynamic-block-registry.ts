import type { Signal } from '@angular/core';

/**
 * Handle for a dynamically loaded block instance.
 * Used by the registry and model parser to resolve refs (e.g. {{RegistrationForm.firstName}}).
 */
export interface BlockInstanceHandle {
  /** Block data: signals, computed, or plain values; used for expression resolution. */
  blockData: Record<string, Signal<unknown> | unknown> | Signal<unknown>;
  /** Optional cleanup (e.g. effect destroy) when the block is destroyed. */
  destroy?: () => void;
}

/**
 * Registry of block instances by id within a single tree.
 * One registry per logical tree; duplicate id in the same tree throws.
 */
export interface DynamicBlockRegistry {
  /** Register a block by id. Throws if id is already registered. */
  register(id: string, handle: BlockInstanceHandle): void;
  /** Unregister when the block is destroyed. */
  unregister(id: string): void;
  /** Get handle by id. */
  get(id: string): BlockInstanceHandle | undefined;
  /** Whether id is registered. */
  has(id: string): boolean;
}

/**
 * Default in-memory implementation of DynamicBlockRegistry.
 */
export class DynamicBlockRegistryImpl implements DynamicBlockRegistry {
  private readonly map = new Map<string, BlockInstanceHandle>();

  register(id: string, handle: BlockInstanceHandle): void {
    if (this.map.has(id)) {
      throw new Error(
        `Block id "${id}" is already registered. Each id may only occur once per tree.`
      );
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
