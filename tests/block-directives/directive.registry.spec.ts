import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Directive } from '@angular/core';
import { DirectiveRegistry } from '../../projects/blocks-studio/src/lib/core/registry/directive.registry';
import { RegistryMetadataStore } from '../../projects/blocks-studio/src/lib/core/registry/registry-metadata';

@Directive({ selector: '[d]', standalone: true })
class RegDirective {}

describe('DirectiveRegistry', () => {
  let registry: DirectiveRegistry;

  beforeEach(() => {
    registry = DirectiveRegistry.getInstance();
    registry.clear();
    RegistryMetadataStore.getInstance().clear();
  });

  afterEach(() => {
    registry.clear();
  });

  it('registers directive type', async () => {
    registry.register('D', RegDirective, { t: 1 });
    expect(await registry.get('D')).toBe(RegDirective);
    expect(registry.getSync('D')).toBe(RegDirective);
    expect(registry.has('D')).toBe(true);
    expect(registry.getMetadata('D')).toEqual({ t: 1 });
  });

  it('warns on duplicate', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registry.register('W', RegDirective);
    registry.register('W', RegDirective);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('lazy loads directive', async () => {
    registry.register('L', async () => RegDirective);
    expect(registry.getSync('L')).toBeUndefined();
    expect(await registry.get('L')).toBe(RegDirective);
  });

  it('lazy load failure', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    registry.register('E', async () => {
      throw new Error('x');
    });
    expect(await registry.get('E')).toBeUndefined();
    err.mockRestore();
  });

  it('getAllWithMetadata', async () => {
    registry.register('M', RegDirective);
    await registry.get('M');
    const map = registry.getAllWithMetadata();
    expect(map.get('M')?.directive).toBe(RegDirective);
  });

  it('unregister and clear', () => {
    registry.register('U', RegDirective);
    registry.unregister('U');
    registry.register('C', RegDirective);
    registry.clear();
    expect(registry.has('C')).toBe(false);
  });
});
