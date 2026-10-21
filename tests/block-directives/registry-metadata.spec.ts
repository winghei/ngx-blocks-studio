import { describe, it, expect, afterEach } from 'vitest';
import { RegistryMetadataStore } from '../../projects/blocks-studio/src/lib/core/registry/registry-metadata';

describe('RegistryMetadataStore', () => {
  const store = RegistryMetadataStore.getInstance();

  afterEach(() => {
    store.clear();
  });

  it('sets and gets metadata by type', () => {
    store.set('A', 'component', { v: 1 });
    store.set('B', 'service', { s: true });
    expect(store.get('A')).toEqual({ v: 1 });
    expect(store.getMetadata('B')).toEqual({ s: true });
    expect(store.has('A')).toBe(true);
  });

  it('getByType and getAllMetadata', () => {
    store.set('C', 'guard', { g: 1 });
    store.set('D', 'directive', { d: 1 });
    store.set('E', 'blockDefinition', { b: 1 });
    const byGuard = store.getByType('guard');
    expect(byGuard.get('C')).toEqual({ g: 1 });
    const all = store.getAllMetadata();
    expect(all.components.size).toBe(0);
    expect(all.guards.get('C')).toEqual({ g: 1 });
    expect(all.directives.get('D')).toEqual({ d: 1 });
    expect(all.blockDefinitions.get('E')).toEqual({ b: 1 });
  });

  it('remove and clear', () => {
    store.set('X', 'service', {});
    expect(store.remove('X')).toBe(true);
    expect(store.get('X')).toBeUndefined();
    store.set('Y', 'service', {});
    store.clear();
    expect(store.has('Y')).toBe(false);
  });
});
