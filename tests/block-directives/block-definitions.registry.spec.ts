import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BlockDefinitionsRegistry,
  isBlockDefinitionLoader,
} from '../../projects/blocks-studio/src/lib/core/registry/block-definitions.registry';
import { RegistryMetadataStore } from '../../projects/blocks-studio/src/lib/core/registry/registry-metadata';
import { Component } from '@angular/core';

describe('BlockDefinitionsRegistry', () => {
  let registry: BlockDefinitionsRegistry;

  beforeEach(() => {
    registry = BlockDefinitionsRegistry.getInstance();
    registry.clear();
    RegistryMetadataStore.getInstance().clear();
  });

  afterEach(() => {
    registry.clear();
  });

  it('isBlockDefinitionLoader distinguishes loader from class', () => {
    expect(isBlockDefinitionLoader(async () => ({}))).toBe(true);
    @Component({ template: '' })
    class C {}
    expect(isBlockDefinitionLoader(C)).toBe(false);
    expect(isBlockDefinitionLoader({})).toBe(false);
  });

  it('registers plain definition', async () => {
    const def = { component: 'X' };
    registry.register('A', def, { m: 1 });
    expect(await registry.get('A')).toEqual(def);
    expect(registry.getSync('A')).toEqual(def);
    expect(registry.has('A')).toBe(true);
    expect(registry.getMetadata('A')).toEqual({ m: 1 });
    expect(registry.getAll()).toEqual({ A: def });
  });

  it('lazy loads definition', async () => {
    registry.register('L', async () => ({ id: 'lazy' }));
    expect(registry.getSync('L')).toBeUndefined();
    expect(await registry.get('L')).toEqual({ id: 'lazy' });
    expect(registry.getAll()).toEqual({ L: { id: 'lazy' } });
  });

  it('lazy load failure', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    registry.register('B', async () => {
      throw new Error('fail');
    });
    expect(await registry.get('B')).toBeUndefined();
    err.mockRestore();
  });

  it('unregister and clear', () => {
    registry.register('U', { c: 1 });
    registry.unregister('U');
    registry.register('C', { c: 2 });
    registry.clear();
    expect(registry.has('C')).toBe(false);
  });
});
