import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { GuardRegistry } from '../../projects/blocks-studio/src/lib/core/registry/guard.registry';
import { RegistryMetadataStore } from '../../projects/blocks-studio/src/lib/core/registry/registry-metadata';

const fnGuard: CanActivateFn = () => true;

@Component({ template: '' })
class ClassGuard {}

describe('GuardRegistry', () => {
  let registry: GuardRegistry;

  beforeEach(() => {
    registry = GuardRegistry.getInstance();
    registry.clear();
    RegistryMetadataStore.getInstance().clear();
  });

  afterEach(() => {
    registry.clear();
  });

  it('registers lazy loader that resolves guard', async () => {
    registry.register('fn', async () => fnGuard, { kind: 'fn' });
    expect(await registry.get('fn')).toBe(fnGuard);
    expect(registry.getSync('fn')).toBe(fnGuard);
    expect(registry.has('fn')).toBe(true);
    expect(registry.getMetadata('fn')).toEqual({ kind: 'fn' });
  });

  it('warns on duplicate', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registry.register('g', fnGuard);
    registry.register('g', fnGuard);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('lazy loads guard', async () => {
    const loader = vi.fn(async () => fnGuard);
    registry.register('lazy', loader);
    expect(registry.getSync('lazy')).toBeUndefined();
    expect(await registry.get('lazy')).toBe(fnGuard);
    expect(loader).toHaveBeenCalled();
  });

  it('lazy load failure', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    registry.register('bad', async () => {
      throw new Error('x');
    });
    expect(await registry.get('bad')).toBeUndefined();
    err.mockRestore();
  });

  it('returns undefined for missing guard', async () => {
    expect(await registry.get('nope')).toBeUndefined();
    expect(registry.getSync('nope')).toBeUndefined();
  });

  it('getAllWithMetadata lists loaded guards', async () => {
    registry.register('a', async () => fnGuard);
    await registry.get('a');
    const all = registry.getAllWithMetadata();
    expect(all.get('a')?.guard).toBe(fnGuard);
  });

  it('registers class guard via async loader', async () => {
    registry.register('cls', async () => ClassGuard);
    expect(await registry.get('cls')).toBe(ClassGuard);
  });

  it('unregister and clear', () => {
    registry.register('u', fnGuard);
    expect(registry.unregister('u')).toBe(true);
    registry.register('c', fnGuard);
    registry.clear();
    expect(registry.has('c')).toBe(false);
  });
});
