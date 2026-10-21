import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computed, signal, type WritableSignal } from '@angular/core';
import {
  resolveRefPath,
  getValueByPath,
  refPathResolvesToSignal,
  getRefValue,
  getRefSignal,
  setRefValue,
  buildComputedForTemplate,
} from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';
import type { ResolverContext } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';

describe('ref-resolver', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function ctx(partial?: Partial<ResolverContext>): ResolverContext {
    const registry = new BlockRegistryImpl();
    const model = signal({ title: 'T', nested: { x: signal(1) } });
    const base: ResolverContext = {
      registry,
      currentBlockId: 'Self',
      currentInstance: {
        model,
        services: {
          Form: { name: signal('Alice'), fn: () => 'fn-val' },
          plain: { label: 'L' },
        },
      },
      ...partial,
    };
    return base;
  }

  it('resolveRefPath treats model with empty path as the model signal', () => {
    const resolved = resolveRefPath('model.', ctx());
    expect(resolved?.path).toEqual([]);
    expect(resolved?.target).toBeTruthy();
  });

  it('resolveRefPath returns null for single-segment paths', () => {
    expect(resolveRefPath('age', ctx())).toBeNull();
  });

  it('resolveRefPath returns null for empty path', () => {
    expect(resolveRefPath('', ctx())).toBeNull();
    expect(resolveRefPath('   ', ctx())).toBeNull();
  });

  it('resolveRefPath resolves current block service path', () => {
    const r = resolveRefPath('Form.name', ctx());
    expect(r).not.toBeNull();
    expect(getRefValue('Form.name', ctx())).toBe('Alice');
  });

  it('resolveRefPath warns on missing scope registry', () => {
    expect(
      resolveRefPath('Scope/Block:Form.name', {
        ...ctx(),
        getRegistryForScope: () => null,
      }),
    ).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('scope'));
  });

  it('resolveRefPath uses scoped registry', () => {
    const scopedReg = new BlockRegistryImpl();
    scopedReg.register('B', {
      instance: { services: { S: { v: 9 } }, model: signal({}) },
    });
    const c = ctx({
      getRegistryForScope: (k) => (k === 'Col' ? scopedReg : null),
    });
    expect(getRefValue('Col/B:S.v', c)).toBe(9);
  });

  it('resolveRefPath self-reference before register', () => {
    const c = ctx({ currentBlockId: 'Self' });
    expect(getRefValue('Self:Form.name', c)).toBe('Alice');
  });

  it('resolveRefPath warns when block id missing', () => {
    expect(getRefValue('Missing:Form.name', ctx())).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('block id'));
  });

  it('resolveRefPath model paths and missing model', () => {
    const c = ctx();
    expect(getRefValue('model.title', c)).toBe('T');
    const noModel = ctx({ currentInstance: { services: {} } });
    expect(resolveRefPath('model.title', noModel)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no instance model'));
  });

  it('resolveRefPath model fallback for named block without service', () => {
    const reg = new BlockRegistryImpl();
    reg.register('Kanban', {
      instance: {
        services: {},
        model: signal({ title: 'Card' }),
      },
    });
    const c: ResolverContext = { registry: reg, currentInstance: { services: {}, model: signal({}) } };
    expect(getRefValue('Kanban:title', c)).toBe('Card');
  });

  it('resolveRefPath returns null when service missing', () => {
    expect(resolveRefPath('Nope.field', ctx())).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('could not resolve service'));
  });

  it('resolveRefPath traverses intermediate null object', () => {
    const c = ctx({
      currentInstance: {
        services: { Bad: signal(null) },
        model: signal({}),
      },
    });
    expect(resolveRefPath('Bad.x.y', c)).toBeNull();
  });

  it('resolveRefPath walks multi-segment service paths', () => {
    const c = ctx({
      currentInstance: {
        services: { Box: { mid: { leaf: 9 } } },
        model: signal({}),
      },
    });
    expect(resolveRefPath('Box.mid.leaf', c)?.path).toEqual(['leaf']);
  });

  it('getValueByPath reads nested paths', () => {
    expect(getValueByPath({ a: { b: 2 } }, 'a.b')).toBe(2);
    expect(getValueByPath(null, 'a')).toBeUndefined();
    expect(getValueByPath({ a: 1 }, 'a.b')).toBeUndefined();
  });

  it('refPathResolvesToSignal detects leaf signals', () => {
    expect(refPathResolvesToSignal('Form.name', ctx())).toBe(true);
    expect(refPathResolvesToSignal('plain.label', ctx())).toBe(false);
  });

  it('refPathResolvesToSignal detects model root signal', () => {
    const m = signal({});
    expect(refPathResolvesToSignal('model', { ...ctx(), currentInstance: { model: m, services: {} } })).toBe(
      true,
    );
  });

  it('resolveRefPath loads instance from registry for block-prefixed refs', () => {
    const reg = new BlockRegistryImpl();
    reg.register('Peer', {
      instance: { services: { S: { v: 3 } }, model: signal({}) },
    });
    expect(
      getRefValue('Peer:S.v', { registry: reg, currentInstance: { services: {}, model: signal({}) } }),
    ).toBe(3);
  });

  it('refPathResolvesToSignal detects service root signals', () => {
    const count = signal(0);
    const c = ctx({
      currentInstance: {
        services: { Count: count },
        model: signal({}),
      },
    });
    expect(refPathResolvesToSignal('Count', c)).toBe(true);
  });

  it('setRefValue writes plain properties on service objects', () => {
    const svc = { n: 1 };
    const c = ctx({
      currentInstance: { services: { S: svc }, model: signal({}) },
    });
    setRefValue('S.n', c, 4);
    expect(svc.n).toBe(4);
  });

  it('getRefValue unwraps functions and nested model signals', () => {
    expect(getRefValue('Form.fn', ctx())).toBe('fn-val');
    const c = ctx();
    expect(getRefValue('model.nested.x', c)).toBe(1);
  });

  it('getRefSignal returns model signal for empty path', () => {
    const m = signal(1);
    const c = ctx({ currentInstance: { model: m, services: {} } });
    expect(getRefSignal('model', c)).toBe(m);
  });

  it('getRefSignal returns undefined when leaf is not a signal', () => {
    const c = ctx({
      currentInstance: {
        services: { Form: { name: 'plain' } },
        model: signal({}),
      },
    });
    expect(getRefSignal('Form.name', c)).toBeUndefined();
  });

  it('getRefSignal returns writable signal at path', () => {
    const s = getRefSignal('Form.name', ctx());
    expect(s).toBeDefined();
    expect(s!()).toBe('Alice');
  });

  it('getRefSignal with signal target and empty path', () => {
    const m = signal({ z: signal(3) });
    const reg = new BlockRegistryImpl();
    const c: ResolverContext = {
      registry: reg,
      currentInstance: { model: m, services: {} },
    };
    expect(getRefSignal('model.z', c)!()).toBe(3);
  });

  it('setRefValue writes to writable signal or plain object', () => {
    const name = signal('A');
    const c = ctx({
      currentInstance: {
        services: { Form: { name } },
        model: signal({}),
      },
    });
    setRefValue('Form.name', c, 'B');
    expect(name()).toBe('B');

    const plain: Record<string, unknown> = { x: 1 };
    const c2 = ctx({
      currentInstance: { services: { P: plain }, model: signal({}) },
    });
    setRefValue('P.x', c2, 2);
    expect(plain.x).toBe(2);
  });

  it('setRefValue no-ops when path empty or unresolved', () => {
    setRefValue('age', ctx(), 1);
    setRefValue('Missing:Form.name', ctx(), 1);
  });

  it('buildComputedForTemplate substitutes refs', () => {
    const c = ctx();
    const tmpl = buildComputedForTemplate('Hi {{Form.name}}!', ['Form.name'], c);
    expect(tmpl()).toBe('Hi Alice!');
  });

  it('warn cache clears after max warnings', () => {
    for (let i = 0; i < 205; i++) {
      resolveRefPath(`Missing${i}:Form.name`, ctx());
    }
    expect(warnSpy.mock.calls.length).toBeGreaterThan(0);
  });
});
