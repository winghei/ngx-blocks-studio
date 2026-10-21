import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Injectable, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ServiceRegistry } from '../../projects/blocks-studio/src/lib/core/registry/service.registry';
import { RegistryMetadataStore } from '../../projects/blocks-studio/src/lib/core/registry/registry-metadata';

@Injectable({ providedIn: 'root' })
class TestSvc {
  value = 42;
}

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = ServiceRegistry.getInstance();
    registry.clear();
    RegistryMetadataStore.getInstance().clear();
  });

  afterEach(() => {
    registry.clear();
  });

  it('registers type and retrieves via injector', async () => {
    await TestBed.configureTestingModule({}).compileComponents();
    registry.setInjector(TestBed.inject(Injector));
    registry.register('TestSvc', TestSvc, { tag: 't' });
    const inst = await registry.get('TestSvc');
    expect(inst).toBeInstanceOf(TestSvc);
    expect(registry.getMetadata('TestSvc')).toEqual({ tag: 't' });
    expect(registry.getSync('TestSvc')).toBeInstanceOf(TestSvc);
    expect(registry.getTypeSync('TestSvc')).toBe(TestSvc);
    expect(registry.has('TestSvc')).toBe(true);
    expect(registry.getAllNames()).toContain('TestSvc');
  });

  it('warns on duplicate register', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registry.register('A', TestSvc);
    registry.register('A', TestSvc);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('lazy loads service', async () => {
    await TestBed.configureTestingModule({ providers: [TestSvc] }).compileComponents();
    registry.setInjector(TestBed.inject(Injector));
    let called = false;
    registry.register('Lazy', async () => {
      called = true;
      return TestSvc;
    });
    const inst = await registry.get('Lazy');
    expect(called).toBe(true);
    expect(inst).toBeInstanceOf(TestSvc);
    expect(await registry.getType('Lazy')).toBe(TestSvc);
  });

  it('handles lazy load failure', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    registry.register('Bad', async () => {
      throw new Error('load fail');
    });
    expect(await registry.get('Bad')).toBeUndefined();
    expect(await registry.getType('Bad')).toBeUndefined();
    err.mockRestore();
  });

  it('errors when service missing', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await registry.get('Missing')).toBeUndefined();
    expect(registry.getSync('Missing')).toBeUndefined();
    err.mockRestore();
  });

  it('getSync warns for lazy loader', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registry.register('L', async () => TestSvc);
    expect(registry.getSync('L')).toBeUndefined();
    expect(registry.getTypeSync('L')).toBeUndefined();
    warn.mockRestore();
  });

  it('inject without injector uses inject() in TestBed', async () => {
    await TestBed.configureTestingModule({ providers: [TestSvc] }).compileComponents();
    registry.setInjector(null as unknown as Injector);
    registry.register('Inj', TestSvc);
    const inst = await TestBed.runInInjectionContext(() => registry.get('Inj'));
    expect(inst).toBeInstanceOf(TestSvc);
  });

  it('inject fails outside injection context', async () => {
    const fresh = ServiceRegistry.getInstance();
    fresh.clear();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    fresh.register('X', TestSvc);
    expect(await fresh.get('X')).toBeUndefined();
    err.mockRestore();
    fresh.clear();
  });

  it('injector.get failure', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badInjector = { get: () => { throw new Error('no'); } } as Injector;
    registry.setInjector(badInjector);
    registry.register('T', TestSvc);
    expect(await registry.get('T')).toBeUndefined();
    err.mockRestore();
  });

  it('unregister and clear', () => {
    registry.register('R', TestSvc);
    expect(registry.unregister('R')).toBe(true);
    expect(registry.has('R')).toBe(false);
    registry.register('C', TestSvc);
    registry.clear();
    expect(registry.has('C')).toBe(false);
  });
});
