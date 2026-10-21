import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BlockRegistryService } from '../../projects/blocks-studio/src/lib/core/services/block-registry.service';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';

describe('BlockRegistryService', () => {
  it('provides root registry and scoped registries', () => {
    const svc = TestBed.inject(BlockRegistryService);
    expect(svc.getRegistryForScope('root')).toBeTruthy();
    expect(svc.getParentScopeKey('root')).toBeNull();

    const scoped = new BlockRegistryImpl();
    svc.setScopedRegistry('col-1', scoped, 'root');
    expect(svc.getRegistryForScope('col-1')).toBe(scoped);
    expect(svc.getParentScopeKey('col-1')).toBe('root');

    svc.removeScopedRegistry('col-1');
    expect(svc.getRegistryForScope('col-1')).toBeNull();
  });

  it('throws when setting root scope', () => {
    const svc = TestBed.inject(BlockRegistryService);
    expect(() => svc.setScopedRegistry('root', new BlockRegistryImpl())).toThrow('reserved');
    svc.removeScopedRegistry('root');
  });

  it('returns null for unknown scope', () => {
    const svc = TestBed.inject(BlockRegistryService);
    expect(svc.getRegistryForScope('missing')).toBeNull();
    expect(svc.getParentScopeKey('missing')).toBeNull();
  });
});
