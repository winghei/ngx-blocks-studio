import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component, Directive, Injectable, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ComponentRegistry } from '../../projects/blocks-studio/src/lib/core/registry/component.registry';
import { DirectiveRegistry } from '../../projects/blocks-studio/src/lib/core/registry/directive.registry';
import { ServiceRegistry } from '../../projects/blocks-studio/src/lib/core/registry/service.registry';
import { GuardRegistry } from '../../projects/blocks-studio/src/lib/core/registry/guard.registry';
import { RegistryMetadataStore } from '../../projects/blocks-studio/src/lib/core/registry/registry-metadata';

describe('registry coverage branches', () => {
  beforeEach(() => {
    RegistryMetadataStore.getInstance().clear();
  });

  describe('ComponentRegistry', () => {
    const reg = () => {
      const r = ComponentRegistry.getInstance();
      r.clear();
      return r;
    };

    it('get returns undefined for unknown name', async () => {
      expect(await reg().get('nope')).toBeUndefined();
      expect(reg().getSync('nope')).toBeUndefined();
    });

    it('get caches eager type on first access', async () => {
      @Component({ template: '' })
      class C {}
      const r = reg();
      r.register('C', C);
      expect(await r.get('C')).toBe(C);
      expect(r.getSync('C')).toBe(C);
    });

    it('getAll and getAllWithMetadata after load', async () => {
      @Component({ template: '' })
      class C {}
      const r = reg();
      r.register('C', C, { tag: 'c' });
      await r.get('C');
      expect(r.getAll().get('C')).toBe(C);
      expect(r.getAllWithMetadata().get('C')?.metadata).toEqual({ tag: 'c' });
    });

    it('lazy load success path', async () => {
      @Component({ template: '' })
      class C {}
      const r = reg();
      r.register('C', async () => C);
      expect(await r.get('C')).toBe(C);
      expect(r.getSync('C')).toBe(C);
    });
  });

  describe('DirectiveRegistry', () => {
    const reg = () => {
      const r = DirectiveRegistry.getInstance();
      r.clear();
      return r;
    };

    it('get returns undefined when missing', async () => {
      expect(await reg().get('x')).toBeUndefined();
    });

    it('register loader clears loaded cache', async () => {
      @Directive({ selector: '[a]' })
      class D {}
      const r = reg();
      r.register('d', D);
      r.register('d', async () => D);
      expect(r.getSync('d')).toBeUndefined();
      expect(await r.get('d')).toBe(D);
    });

    it('getAllWithMetadata lists loaded directives', async () => {
      @Directive({ selector: '[b]' })
      class D {}
      const r = reg();
      r.register('d', D, { m: 1 });
      await r.get('d');
      expect(r.getAllWithMetadata().get('d')?.metadata).toEqual({ m: 1 });
    });
  });

  describe('ServiceRegistry', () => {
    let registry: ServiceRegistry;

    beforeEach(() => {
      registry = ServiceRegistry.getInstance();
      registry.clear();
    });

    it('getType returns undefined when missing', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(await registry.getType('nope')).toBeUndefined();
      err.mockRestore();
    });

    it('getTypeSync returns undefined for lazy entry', () => {
      @Injectable()
      class S {}
      registry.register('s', async () => S);
      expect(registry.getTypeSync('s')).toBeUndefined();
    });

    it('caches class type on register', async () => {
      @Injectable()
      class S {}
      await TestBed.configureTestingModule({ providers: [S] }).compileComponents();
      registry.setInjector(TestBed.inject(Injector));
      registry.register('s', S);
      expect(await registry.get('s')).toBeInstanceOf(S);
    });

    it('getTypeSync loads eager type', () => {
      @Injectable()
      class S {}
      registry.register('s', S);
      expect(registry.getTypeSync('s')).toBe(S);
    });

    it('getSync and getType repopulate cache after eviction', async () => {
      @Injectable()
      class S {}
      await TestBed.configureTestingModule({ providers: [S] }).compileComponents();
      registry.setInjector(TestBed.inject(Injector));
      registry.register('s', S);
      (registry as unknown as { loadedServices: Map<string, unknown> }).loadedServices.delete('s');
      expect(registry.getSync('s')).toBeInstanceOf(S);
      (registry as unknown as { loadedServices: Map<string, unknown> }).loadedServices.delete('s');
      expect(await registry.getType('s')).toBe(S);
      expect(registry.getTypeSync('missing')).toBeUndefined();
    });

    it('lazy getType loads and caches', async () => {
      @Injectable()
      class S {}
      registry.register('s', async () => S);
      expect(await registry.getType('s')).toBe(S);
    });

    it('get() repopulates cache after eviction', async () => {
      @Injectable()
      class S {}
      await TestBed.configureTestingModule({ providers: [S] }).compileComponents();
      registry.setInjector(TestBed.inject(Injector));
      registry.register('s', S);
      (registry as unknown as { loadedServices: Map<string, unknown> }).loadedServices.delete('s');
      expect(await registry.get('s')).toBeInstanceOf(S);
    });
  });

  describe('DirectiveRegistry isLoader', () => {
    it('returns false for non-function values', () => {
      const r = DirectiveRegistry.getInstance();
      const isLoader = (r as unknown as { isLoader: (v: unknown) => boolean }).isLoader.bind(r);
      expect(isLoader({})).toBe(false);
    });
  });

  describe('GuardRegistry', () => {
    const reg = () => {
      const r = GuardRegistry.getInstance();
      r.clear();
      return r;
    };

    it('register non-loader stores in loadedGuards', async () => {
      const fn = (() => true) as never;
      Object.defineProperty(fn, 'length', { value: 1 });
      const r = reg();
      r.register('g', fn);
      expect(r.getSync('g')).toBe(fn);
      expect(await r.get('g')).toBe(fn);
    });

    it('get returns undefined when missing', async () => {
      expect(await reg().get('nope')).toBeUndefined();
    });

    it('getAllWithMetadata lists guards', async () => {
      const fn = (() => true) as never;
      Object.defineProperty(fn, 'length', { value: 1 });
      const r = reg();
      r.register('g', fn, { role: 'auth' });
      await r.get('g');
      expect(r.getAllWithMetadata().get('g')?.metadata).toEqual({ role: 'auth' });
    });
  });
});
