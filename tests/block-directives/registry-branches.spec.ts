import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component, Directive, Injectable, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BlockDefinitionsRegistry } from '../../projects/blocks-studio/src/lib/core/registry/block-definitions.registry';
import { ComponentRegistry } from '../../projects/blocks-studio/src/lib/core/registry/component.registry';
import { ServiceRegistry } from '../../projects/blocks-studio/src/lib/core/registry/service.registry';
import { GuardRegistry } from '../../projects/blocks-studio/src/lib/core/registry/guard.registry';
import { RegistryMetadataStore } from '../../projects/blocks-studio/src/lib/core/registry/registry-metadata';

describe('registry branch coverage', () => {
  beforeEach(() => RegistryMetadataStore.getInstance().clear());

  it('BlockDefinitionsRegistry get caches plain object on get', async () => {
    const r = BlockDefinitionsRegistry.getInstance();
    r.clear();
    r.register('d', { x: 1 });
    expect(await r.get('d')).toEqual({ x: 1 });
    expect(r.getSync('d')).toEqual({ x: 1 });
    r.clear();
  });

  it('ComponentRegistry lazy get error path', async () => {
    const r = ComponentRegistry.getInstance();
    r.clear();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    r.register('e', async () => {
      throw new Error('x');
    });
    expect(await r.get('e')).toBeUndefined();
    err.mockRestore();
    r.clear();
  });

  it('ServiceRegistry lazy get error in get()', async () => {
    const r = ServiceRegistry.getInstance();
    r.clear();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    r.register('e', async () => {
      throw new Error('x');
    });
    expect(await r.get('e')).toBeUndefined();
    err.mockRestore();
    r.clear();
  });

  it('GuardRegistry getSync returns cached guard', async () => {
    const r = GuardRegistry.getInstance();
    r.clear();
    const g = (() => true) as never;
    Object.defineProperty(g, 'length', { value: 1 });
    r.register('g', g);
    expect(r.getSync('g')).toBe(g);
    r.clear();
  });

  it('ServiceRegistry register skips empty metadata', () => {
    const r = ServiceRegistry.getInstance();
    r.clear();
    @Injectable()
    class S {}
    r.register('s', S, {});
    expect(r.getMetadata('s')).toBeUndefined();
    r.clear();
  });
});
