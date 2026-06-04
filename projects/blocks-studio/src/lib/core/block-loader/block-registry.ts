import type { Signal } from '@angular/core';

export interface CurrentInstance {
  model?: Signal<unknown>;
  /**
   * Services/state exposed by name for ref/expression resolution.
   * (Kept separate from `model` to avoid alias collisions.)
   */
  services: Record<string, unknown>;
}

/**
 * Handle for a registered block: exposes instance (services/state by name) for ref resolution.
 */
export interface BlockInstanceHandle {
  /** Instance: services and state by name (e.g. FormState, value). */
  instance: CurrentInstance;
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
  /** True if id resolves in this registry or any parent (for refs). */
  has(id: string): boolean;
  /** True only if id is registered on this registry layer (not parent). Used before register. */
  hasLocal(id: string): boolean;
}

/**
 * Registry that chains lookups to a parent registry (lexical scoping).
 * Registration/unregistration always happens on the local registry only.
 */
export class ChainedBlockRegistry implements BlockRegistry {
  constructor(
    private readonly local: BlockRegistry,
    private readonly parent: BlockRegistry | null,
  ) {}

  register(id: string, handle: BlockInstanceHandle): void {
    this.local.register(id, handle);
  }

  unregister(id: string): void {
    this.local.unregister(id);
  }

  get(id: string): BlockInstanceHandle | undefined {
    return this.local.get(id) ?? this.parent?.get(id);
  }

  has(id: string): boolean {
    return this.local.has(id) || (this.parent?.has(id) ?? false);
  }

  hasLocal(id: string): boolean {
    return this.local.hasLocal(id);
  }
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

  hasLocal(id: string): boolean {
    return this.map.has(id);
  }
}
