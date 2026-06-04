import { Injectable } from '@angular/core';
import { BlockRegistryImpl, type BlockRegistry } from '../block-loader/block-registry';

export interface ScopedRegistryNode {
  registry: BlockRegistry;
  parentScopeKey: string | null;
}

/**
 * Holds named block registries (e.g. `root` for a route outlet, scoped keys for list items/columns).
 * This enables explicit cross-scope ref resolution like `ScopeKey/BlockId:model.title`.
 */
@Injectable({ providedIn: 'root' })
export class BlockRegistryService {
  readonly registry = new Map<string, ScopedRegistryNode>([
    ['root', { registry: new BlockRegistryImpl(), parentScopeKey: null }],
  ]);

  setScopedRegistry(key: string, reg: BlockRegistry, parentScopeKey: string | null = 'root'): void {
    if (key === 'root') {
      throw new Error('Cannot set scoped registry under reserved key "root".');
    }
    this.registry.set(key, { registry: reg, parentScopeKey });
  }

  removeScopedRegistry(key: string): void {
    if (key === 'root') return;
    this.registry.delete(key);
  }

  getRegistryForScope(scopeKey: string): BlockRegistry | null {
    return this.registry.get(scopeKey)?.registry ?? null;
  }

  getParentScopeKey(scopeKey: string): string | null {
    return this.registry.get(scopeKey)?.parentScopeKey ?? null;
  }
}

