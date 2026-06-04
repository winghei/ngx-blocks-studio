import { describe, it, expect } from 'vitest';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';

describe('BlockRegistryImpl', () => {
  it('starts empty', () => {
    const reg = new BlockRegistryImpl();
    expect(reg.has('X')).toBe(false);
    expect(reg.get('X')).toBeUndefined();
  });

  it('registers and retrieves a handle', () => {
    const reg = new BlockRegistryImpl();
    const handle = { instance: { foo: 1 } };
    reg.register('Block1', handle);
    expect(reg.has('Block1')).toBe(true);
    expect(reg.get('Block1')).toBe(handle);
  });

  it('throws when registering duplicate id', () => {
    const reg = new BlockRegistryImpl();
    reg.register('X', { instance: {} });
    expect(() => reg.register('X', { instance: {} })).toThrow(
      'Block id "X" is already registered',
    );
  });

  it('unregisters and removes handle', () => {
    const reg = new BlockRegistryImpl();
    reg.register('Y', { instance: {} });
    reg.unregister('Y');
    expect(reg.has('Y')).toBe(false);
    expect(reg.get('Y')).toBeUndefined();
  });

  it('allows re-registering after unregister', () => {
    const reg = new BlockRegistryImpl();
    reg.register('Z', { instance: { v: 1 } });
    reg.unregister('Z');
    reg.register('Z', { instance: { v: 2 } });
    expect(reg.get('Z')?.instance).toEqual({ v: 2 });
  });
});
