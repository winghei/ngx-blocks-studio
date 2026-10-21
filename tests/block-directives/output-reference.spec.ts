import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import {
  splitCallableRef,
  createOutputHandler,
} from '../../projects/blocks-studio/src/lib/core/block-loader/output-reference';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';
import type { ResolverContext } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';

function makeCtx(services: Record<string, unknown> = {}): ResolverContext {
  const registry = new BlockRegistryImpl();
  return {
    registry,
    currentInstance: { services, model: signal({}) },
  };
}

describe('splitCallableRef', () => {
  it('returns null for empty or too-short paths', () => {
    expect(splitCallableRef('')).toBeNull();
    expect(splitCallableRef('   ')).toBeNull();
    expect(splitCallableRef('onlymethod')).toBeNull();
    expect(splitCallableRef('Block:only')).toBeNull();
  });

  it('splits block-prefixed callable refs', () => {
    expect(splitCallableRef('MyBlock:Svc.doThing')).toEqual({
      refPath: 'MyBlock:Svc',
      method: 'doThing',
    });
  });

  it('splits current-block dotted callable refs', () => {
    expect(splitCallableRef('Svc.nested.method')).toEqual({
      refPath: 'Svc.nested',
      method: 'method',
    });
  });
});

describe('createOutputHandler', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns no-op for non-callable output values', () => {
    const handler = createOutputHandler(42, 'out', makeCtx());
    expect(handler('x')).toBeUndefined();
  });

  it('invokes method on service with event payload', () => {
    const fn = vi.fn();
    const ctx = makeCtx({ Nav: { go: fn } });
    const handler = createOutputHandler('Nav.go', 'click', ctx);
    handler({ id: 1 });
    expect(fn).toHaveBeenCalledWith({ id: 1 });
  });

  it('warns on invalid callable ref', () => {
    const handler = createOutputHandler('badref', 'out', makeCtx());
    handler(null);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid output callable'));
  });

  it('warns when method is not callable', () => {
    const ctx = makeCtx({ S: { go: 'not-fn' } });
    const handler = createOutputHandler('S.go', 'out', ctx);
    handler(null);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not a callable'));
  });

  it('warns when leaf on object is non-function', () => {
    const ctx = makeCtx({ S: { nested: { go: 1 } } });
    const handler = createOutputHandler('S.nested.go', 'out', ctx);
    handler(null);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('skips when when-condition is falsy', () => {
    const fn = vi.fn();
    const ctx = makeCtx({ S: { go: fn } });
    const handler = createOutputHandler(
      { ref: 'S.go', when: 'false' },
      'out',
      ctx,
    );
    handler(null);
    expect(fn).not.toHaveBeenCalled();
  });

  it('treats string when "0" and "off" as falsy', () => {
    const fn = vi.fn();
    const ctx = makeCtx({ S: { go: fn } });
    createOutputHandler({ ref: 'S.go', when: '0' }, 'out', ctx)(null);
    createOutputHandler({ ref: 'S.go', when: 'off' }, 'out', ctx)(null);
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not recurse into objects with component key', () => {
    const fn = vi.fn();
    const ctx = makeCtx({ S: { go: fn } });
    createOutputHandler(
      {
        ref: 'S.go',
        params: [{ component: 'Skip', nested: '{{ ref("model") }}' }],
      },
      'out',
      ctx,
    )(null);
    expect(fn).toHaveBeenCalledWith({ component: 'Skip', nested: '{{ ref("model") }}' });
  });

  it('resolves params array and object templates', () => {
    const fn = vi.fn();
    const ctx = makeCtx({ S: { go: fn } });
    const handler = createOutputHandler(
      {
        ref: 'S.go',
        params: [{ x: '{{ ref("model") }}' }, 'plain'],
      },
      'out',
      ctx,
    );
    handler(null);
    expect(fn).toHaveBeenCalled();
  });

  it('runs then chain on success and nested then', async () => {
    const order: string[] = [];
    const ctx = makeCtx({
      S: {
        first: () => {
          order.push('first');
        },
        second: () => {
          order.push('second');
        },
      },
    });
    const handler = createOutputHandler(
      {
        ref: 'S.first',
        then: [
          'S.second',
          {
            ref: 'S.second',
            when: 'yes',
            then: ['S.first'],
          },
        ],
      },
      'out',
      ctx,
    );
    handler(null);
    expect(order).toEqual(['first', 'second', 'second', 'first']);
  });

  it('skips then step when when is falsy', () => {
    const fn = vi.fn();
    createOutputHandler(
      { ref: 'S.first', then: [{ ref: 'S.step', when: '' }] },
      'out',
      makeCtx({ S: { first: () => {}, step: fn } }),
    )(null);
    expect(fn).not.toHaveBeenCalled();
  });

  it('warns on invalid then ref and stops chain', () => {
    createOutputHandler(
      { ref: 'S.first', then: ['invalid'] },
      'out',
      makeCtx({ S: { first: () => {} } }),
    )(null);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('then chain'));
  });

  it('passes array params to then steps', () => {
    const fn = vi.fn();
    createOutputHandler(
      { ref: 'S.first', then: [{ ref: 'S.second', params: ['a', 'b'] }] },
      'out',
      makeCtx({ S: { first: () => {}, second: fn } }),
    )(null);
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });

  it('runs onError when then step promise rejects', async () => {
    const err = vi.fn();
    createOutputHandler(
      {
        ref: 'S.first',
        then: ['S.fail'],
        onError: { ref: 'S.err', when: true },
      },
      'out',
      makeCtx({
        S: {
          first: () => {},
          fail: () => Promise.reject(1),
          err,
        },
      }),
    )(null);
    await Promise.resolve();
    await Promise.resolve();
    expect(err).toHaveBeenCalled();
  });

  it('handles promise result and runs then', async () => {
    const second = vi.fn();
    const ctx = makeCtx({
      S: {
        asyncOp: () => Promise.resolve(),
        second,
      },
    });
    const handler = createOutputHandler(
      { ref: 'S.asyncOp', then: ['S.second'] },
      'out',
      ctx,
    );
    handler(null);
    await Promise.resolve();
    expect(second).toHaveBeenCalled();
  });

  it('runOnError returns early when onError.when is false', async () => {
    const onErr = vi.fn();
    createOutputHandler(
      {
        ref: 'S.fail',
        onError: { ref: 'S.onErr', when: false },
      },
      'out',
      makeCtx({
        S: {
          fail: () => Promise.reject(new Error('x')),
          onErr,
        },
      }),
    )(null);
    await Promise.resolve();
    await Promise.resolve();
    expect(onErr).not.toHaveBeenCalled();
  });

  it('runOnError returns early when output def has no onError', async () => {
    const err = vi.fn();
    createOutputHandler(
      { ref: 'S.fail', then: ['S.next'] },
      'out',
      makeCtx({
        S: {
          fail: () => Promise.reject(new Error('x')),
          next: () => {},
          err,
        },
      }),
    )(null);
    await Promise.resolve();
    await Promise.resolve();
    expect(err).not.toHaveBeenCalled();
  });

  it('runOnError runs when onError.when is omitted (defaults to true)', async () => {
    const onErr = vi.fn();
    const ctx = makeCtx({
      S: {
        fail: () => Promise.reject(new Error('x')),
        onErr,
      },
    });
    createOutputHandler(
      {
        ref: 'S.fail',
        onError: { ref: 'S.onErr' },
      },
      'out',
      ctx,
    )(null);
    await vi.waitFor(() => expect(onErr).toHaveBeenCalled());
  });

  it('runs onError when promise rejects', async () => {
    const onErr = vi.fn();
    const ctx = makeCtx({
      S: {
        fail: () => Promise.reject(new Error('x')),
        onErr,
      },
    });
    const handler = createOutputHandler(
      {
        ref: 'S.fail',
        onError: { ref: 'S.onErr', when: true },
      },
      'out',
      ctx,
    );
    handler(null);
    await Promise.resolve();
    await Promise.resolve();
    expect(onErr).toHaveBeenCalled();
  });

  it('warns on invalid onError ref', async () => {
    const ctx = makeCtx({
      S: { fail: () => Promise.reject(new Error('x')) },
    });
    createOutputHandler(
      { ref: 'S.fail', onError: { ref: 'bad', when: true } },
      'out',
      ctx,
    )(null);
    await Promise.resolve();
    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('onError'));
  });

  it('warns when then-step method missing and onError invoke invalid', async () => {
    createOutputHandler(
      { ref: 'S.first', then: ['S.missing'] },
      'out',
      makeCtx({ S: { first: () => {} } }),
    )(null);
    expect(warnSpy).toHaveBeenCalled();
    createOutputHandler(
      { ref: 'S.fail', onError: { ref: 'bad.err', when: true } },
      'out',
      makeCtx({ S: { fail: () => Promise.reject(1) } }),
    )(null);
    await Promise.resolve();
    await Promise.resolve();
  });

  it('uses colon-block ref path via getCallTarget with nested path', () => {
    const fn = vi.fn();
    const registry = new BlockRegistryImpl();
    const id = 'B1';
    registry.register(id, {
      instance: { services: { X: { run: fn } }, model: signal({}) },
    });
    const ctx: ResolverContext = {
      registry,
      currentBlockId: 'other',
      currentInstance: { services: {}, model: signal({}) },
    };
    createOutputHandler(`B1:X.run`, 'out', ctx)({ p: 1 });
    expect(fn).toHaveBeenCalledWith({ p: 1 });
  });
});
