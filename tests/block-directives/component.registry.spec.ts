import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component } from '@angular/core';
import { ComponentRegistry } from '../../projects/blocks-studio/src/lib/core/registry/component.registry';
import { RegistryMetadataStore } from '../../projects/blocks-studio/src/lib/core/registry/registry-metadata';

@Component({ standalone: true, template: '' })
class RegComponent {}

describe('ComponentRegistry', () => {
  let registry: ComponentRegistry;

  beforeEach(() => {
    registry = ComponentRegistry.getInstance();
    registry.clear();
    RegistryMetadataStore.getInstance().clear();
  });

  afterEach(() => {
    registry.clear();
  });

  it('registers and gets component type', async () => {
    registry.register('C', RegComponent, { v: 1 });
    expect(await registry.get('C')).toBe(RegComponent);
    expect(registry.getSync('C')).toBe(RegComponent);
    expect(registry.has('C')).toBe(true);
    expect(registry.getMetadata('C')).toEqual({ v: 1 });
    expect(registry.getAll().get('C')).toBe(RegComponent);
  });

  it('warns on overwrite', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registry.register('W', RegComponent);
    registry.register('W', RegComponent);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('lazy loads component', async () => {
    let called = false;
    registry.register('L', async () => {
      called = true;
      return RegComponent;
    });
    expect(registry.getSync('L')).toBeUndefined();
    expect(await registry.get('L')).toBe(RegComponent);
    expect(called).toBe(true);
  });

  it('lazy load error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    registry.register('E', async () => {
      throw new Error('fail');
    });
    expect(await registry.get('E')).toBeUndefined();
    err.mockRestore();
  });

  it('getAllWithMetadata', async () => {
    registry.register('M', RegComponent, { m: true });
    await registry.get('M');
    const map = registry.getAllWithMetadata();
    expect(map.get('M')?.component).toBe(RegComponent);
    expect(map.get('M')?.metadata).toEqual({ m: true });
  });

  it('unregister and clear', () => {
    registry.register('U', RegComponent);
    expect(registry.unregister('U')).toBe(true);
    registry.register('X', RegComponent);
    registry.clear();
    expect(registry.has('X')).toBe(false);
  });
});
