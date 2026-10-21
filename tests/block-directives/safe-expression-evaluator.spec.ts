import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { evaluateSafeExpression } from '../../projects/blocks-studio/src/lib/core/block-loader/safe-expression-evaluator';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';
import type { ResolverContext } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';
import { getRefValue } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';

function ctx(): ResolverContext {
  return {
    registry: new BlockRegistryImpl(),
    currentInstance: {
      model: signal({ n: 2, name: 'Bob' }),
      services: { S: { count: 10, getVal: () => 99 } },
    },
  };
}

describe('evaluateSafeExpression', () => {
  it('evaluates literals and identifiers', () => {
    const c = ctx();
    expect(evaluateSafeExpression('1 + 2', c, null, getRefValue)).toBe(3);
    expect(evaluateSafeExpression('n * 2', c, null, getRefValue)).toBe(4);
    expect(evaluateSafeExpression('$event', c, { id: 1 }, getRefValue)).toEqual({ id: 1 });
    expect(evaluateSafeExpression('payload', c, 'p', getRefValue)).toBe('p');
    expect(evaluateSafeExpression('S.count', c, null, getRefValue)).toBe(10);
  });

  it('evaluates ref() calls', () => {
    const c = ctx();
    expect(evaluateSafeExpression('ref("S.count")', c, null, getRefValue)).toBe(10);
    expect(evaluateSafeExpression('ref("model.name")', c, null, getRefValue)).toBe('Bob');
    expect(evaluateSafeExpression('ref("S.getVal", true)', c, null, getRefValue)).toBe(99);
  });

  it('evaluates member/index on ref result function', () => {
    const c = ctx();
    c.currentInstance!.services = {
      S: { data: () => ({ title: 'T' }) },
    };
    expect(evaluateSafeExpression('ref("S.data").title', c, null, getRefValue)).toBe('T');
    expect(evaluateSafeExpression('ref("S.data")["title"]', c, null, getRefValue)).toBe('T');
  });

  it('evaluates logical, comparison, and unary ops', () => {
    const c = ctx();
    expect(evaluateSafeExpression('true && false', c, null, getRefValue)).toBe(false);
    expect(evaluateSafeExpression('true || false', c, null, getRefValue)).toBe(true);
    expect(evaluateSafeExpression('1 === 1', c, null, getRefValue)).toBe(true);
    expect(evaluateSafeExpression('1 != 2', c, null, getRefValue)).toBe(true);
    expect(evaluateSafeExpression('1 != 1', c, null, getRefValue)).toBe(false);
    expect(evaluateSafeExpression('1 == 1', c, null, getRefValue)).toBe(true);
    expect(evaluateSafeExpression('!false', c, null, getRefValue)).toBe(true);
    expect(evaluateSafeExpression('+5', c, null, getRefValue)).toBe(5);
    expect(evaluateSafeExpression('-5', c, null, getRefValue)).toBe(-5);
    expect(evaluateSafeExpression('3 < 5', c, null, getRefValue)).toBe(true);
    expect(evaluateSafeExpression('3 <= 3', c, null, getRefValue)).toBe(true);
    expect(evaluateSafeExpression('5 > 3', c, null, getRefValue)).toBe(true);
    expect(evaluateSafeExpression('5 >= 5', c, null, getRefValue)).toBe(true);
    expect(evaluateSafeExpression('5 % 2', c, null, getRefValue)).toBe(1);
    expect(evaluateSafeExpression('6 / 2', c, null, getRefValue)).toBe(3);
  });

  it('evaluates ternary', () => {
    expect(evaluateSafeExpression('true ? 1 : 2', ctx(), null, getRefValue)).toBe(1);
  });

  it('parses strings with escapes', () => {
    expect(evaluateSafeExpression('"a\\"b"', ctx(), null, getRefValue)).toBe('a"b');
  });

  it('throws on bad tokens and disallowed calls', () => {
    expect(() => evaluateSafeExpression('@', ctx(), null, getRefValue)).toThrow();
    expect(() => evaluateSafeExpression('foo()', ctx(), null, getRefValue)).toThrow('Only ref');
    expect(() => evaluateSafeExpression('ref()', ctx(), null, getRefValue)).toThrow('one or two');
    expect(evaluateSafeExpression('ref(1)', ctx(), null, getRefValue)).toBeUndefined();
    expect(() => evaluateSafeExpression('1 +', ctx(), null, getRefValue)).toThrow();
    expect(() => evaluateSafeExpression('"unterminated', ctx(), null, getRefValue)).toThrow(
      'Unterminated',
    );
  });

  it('returns undefined for unknown identifier and bad index keys', () => {
    const c = ctx();
    expect(evaluateSafeExpression('unknown', c, null, getRefValue)).toBeUndefined();
    expect(evaluateSafeExpression('n[null]', c, null, getRefValue)).toBeUndefined();
  });

  it('invokes ref when second arg is true', () => {
    const c = ctx();
    c.currentInstance!.services = { S: { fn: () => 42 } };
    expect(evaluateSafeExpression('ref("S.fn", true)', c, null, getRefValue)).toBe(42);
  });

  it('evaluates member access on ref function result', () => {
    const c = ctx();
    c.currentInstance!.services = { S: { data: () => ({ z: 3 }) } };
    expect(evaluateSafeExpression('ref("S.data").z', c, null, getRefValue)).toBe(3);
    expect(evaluateSafeExpression('ref("S.data")["z"]', c, null, getRefValue)).toBe(3);
  });

  it('parses grouped expressions and strict equality', () => {
    const c = ctx();
    expect(evaluateSafeExpression('(2)', c, null, getRefValue)).toBe(2);
    expect(evaluateSafeExpression('1 === 1', c, null, getRefValue)).toBe(true);
    expect(evaluateSafeExpression('1 !== 2', c, null, getRefValue)).toBe(true);
    expect(evaluateSafeExpression('3 >= 2', c, null, getRefValue)).toBe(true);
  });

  it('unwraps ref() functions for member and index access', () => {
    const c = ctx();
    c.currentInstance!.services = {
      S: { pick: () => ({ k: 'v' }) },
    };
    expect(evaluateSafeExpression('ref("S.pick").k', c, null, getRefValue)).toBe('v');
    expect(evaluateSafeExpression('ref("S.pick")["k"]', c, null, getRefValue)).toBe('v');
  });

  it('invokes ref target when second argument is literal true', () => {
    const c = ctx();
    const resolve = (path: string) => {
      if (path === 'S.run') return () => 'done';
      return getRefValue(path, c);
    };
    expect(evaluateSafeExpression('ref("S.run", true)', c, null, resolve)).toBe('done');
  });

  it('unwraps ref functions when resolver returns a callable', () => {
    const c = ctx();
    const resolve = (path: string) => {
      if (path === 'S.pick') return () => ({ k: 'v' });
      return getRefValue(path, c);
    };
    expect(evaluateSafeExpression('ref("S.pick").k', c, null, resolve)).toBe('v');
    expect(evaluateSafeExpression('ref("S.pick")["k"]', c, null, resolve)).toBe('v');
  });

  it('evaluates numeric subtraction', () => {
    expect(evaluateSafeExpression('5 - 2', ctx(), null, getRefValue)).toBe(3);
  });

  it('evaluates unary minus on refs and rejects invalid index targets', () => {
    const c = ctx();
    c.currentInstance!.model = signal({ n: 4 });
    expect(evaluateSafeExpression('-ref("model.n")', c, null, getRefValue)).toBe(-4);
    expect(evaluateSafeExpression('ref("model.n")[0]', c, null, getRefValue)).toBeUndefined();
  });

  it('evaluates unary plus and numeric array index', () => {
    const c = ctx();
    c.currentInstance!.model = signal({ arr: [7] });
    expect(evaluateSafeExpression('+3', c, null, getRefValue)).toBe(3);
    expect(evaluateSafeExpression('arr[0]', c, null, getRefValue)).toBe(7);
  });
});
