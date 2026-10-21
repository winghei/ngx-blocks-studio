import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import {
  resolveNestedTemplateValues,
  valueNeedsInputResolve,
  valueContainsMustacheInTree,
  isPlainObject,
} from '../../projects/blocks-studio/src/lib/core/block-loader/nested-template-resolve';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';
import type { ResolverContext } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';

function makeCtx(activitiesDataSetId: ReturnType<typeof signal<string>>): ResolverContext {
  return {
    registry: new BlockRegistryImpl(),
    currentInstance: {
      services: { AmsService: { activitiesDataSetId } },
      model: signal(undefined),
    },
  };
}

describe('valueNeedsInputResolve', () => {
  it('is false for plain strings without templates', () => {
    expect(valueNeedsInputResolve('plain-label')).toBe(false);
  });

  it('is false for plain config objects', () => {
    expect(valueNeedsInputResolve({ pivot_enabled: true, context: {} })).toBe(false);
  });

  it('is true when a nested string has mustache', () => {
    expect(
      valueNeedsInputResolve({
        data_set_id: "{{ ref('AmsService.activitiesDataSetId') }}",
      }),
    ).toBe(true);
  });
});

describe('resolveNestedTemplateValues', () => {
  it('resolves nested mustache in objects reactively', () => {
    const id = signal('dataset-42');
    const ctx = makeCtx(id);
    const source = {
      data_set_id: "{{ ref('AmsService.activitiesDataSetId') }}",
      pivot_enabled: true,
    };

    expect(
      resolveNestedTemplateValues(source, ctx, 'config', new WeakSet(), {
        resolveTwoWayStringsAsReadonly: true,
      }),
    ).toEqual({ data_set_id: 'dataset-42', pivot_enabled: true });

    id.set('dataset-99');
    expect(
      resolveNestedTemplateValues(source, ctx, 'config', new WeakSet(), {
        resolveTwoWayStringsAsReadonly: true,
      }),
    ).toEqual({ data_set_id: 'dataset-99', pivot_enabled: true });
  });

  it('resolves nested [(refPath)] as read-only value', () => {
    const id = signal('from-signal');
    const ctx = makeCtx(id);
    const out = resolveNestedTemplateValues(
      { id: '[(AmsService.activitiesDataSetId)]' },
      ctx,
      'config',
      new WeakSet(),
      { resolveTwoWayStringsAsReadonly: true },
    );
    expect(out).toEqual({ id: 'from-signal' });
  });

  it('valueContainsMustacheInTree handles arrays', () => {
    expect(valueContainsMustacheInTree(['{{a}}'])).toBe(true);
    expect(valueContainsMustacheInTree([1])).toBe(false);
  });

  it('valueNeedsInputResolve is true for strings that look like partial two-way refs', () => {
    expect(valueNeedsInputResolve('value)]')).toBe(true);
  });

  it('detects flow templates in valueNeedsInputResolve', () => {
    expect(valueNeedsInputResolve('@if (x) {}')).toBe(true);
  });

  it('isPlainObject rejects arrays and class instances', () => {
    expect(isPlainObject([])).toBe(false);
    class X {}
    expect(isPlainObject(new X())).toBe(false);
  });

  it('valueContainsMustacheInTree and cyclic plain objects', () => {
    expect(valueContainsMustacheInTree({ a: '{{ x }}' })).toBe(true);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(valueContainsMustacheInTree(cycle)).toBe(false);
    expect(valueNeedsInputResolve(cycle)).toBe(false);
  });

  it('throws on invalid two-way mix in nested resolve', () => {
    const ctx = makeCtx(signal('a'));
    expect(() =>
      resolveNestedTemplateValues(
        { bad: '[(x)] {{ y }}' },
        ctx,
        'config',
        new WeakSet(),
        { resolveTwoWayStringsAsReadonly: true },
      ),
    ).toThrow(/cannot be mixed/);
  });

  it('resolves plain string leaves without template markers', () => {
    const ctx = makeCtx(signal('a'));
    expect(resolveNestedTemplateValues('plain-text', ctx, 'field', new WeakSet(), {})).toBe(
      'plain-text',
    );
  });

  it('readonly two-way with empty ref path falls through to template resolve', () => {
    const ctx = makeCtx(signal('a'));
    expect(
      resolveNestedTemplateValues('[(   )]', ctx, 'field', new WeakSet(), {
        resolveTwoWayStringsAsReadonly: true,
      }),
    ).toBe('[(   )]');
  });

  it('returns non-plain objects unchanged', () => {
    const d = new Date();
    expect(
      resolveNestedTemplateValues(d, makeCtx(signal('a')), 'p', new WeakSet(), {}),
    ).toBe(d);
  });

  it('resolves strings inside nested arrays and objects', () => {
    const id = signal('x');
    const ctx = makeCtx(id);
    const source = {
      rows: [{ label: "{{ ref('AmsService.activitiesDataSetId') }}" }],
    };
    expect(
      resolveNestedTemplateValues(source, ctx, 'config', new WeakSet(), {
        resolveTwoWayStringsAsReadonly: true,
      }),
    ).toEqual({ rows: [{ label: 'x' }] });
  });
});
