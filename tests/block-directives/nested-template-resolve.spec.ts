import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import {
  resolveNestedTemplateValues,
  valueNeedsInputResolve,
  valueContainsMustacheInTree,
  isPlainObject,
  looksLikeBlockDescriptor,
  shouldDeferInputTemplateResolution,
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

describe('looksLikeBlockDescriptor', () => {
  it('detects shorthand { id: blockId } references', () => {
    expect(looksLikeBlockDescriptor({ id: 'AppNav' })).toBe(true);
    expect(shouldDeferInputTemplateResolution({ id: 'AppNav' })).toBe(true);
  });

  it('detects { id, blockDefinition } without blockId', () => {
    expect(
      looksLikeBlockDescriptor({
        id: 'WelcomeTitle',
        blockDefinition: { inputs: { html: '{{ x }}' } },
      }),
    ).toBe(true);
  });

  it('rejects { id, ...extra } config objects (not a lone block reference)', () => {
    expect(looksLikeBlockDescriptor({ id: 'Segment', role: 'label' })).toBe(false);
  });

  it('rejects id strings that embed template syntax', () => {
    expect(looksLikeBlockDescriptor({ id: '{{ blockId }}' })).toBe(false);
    expect(looksLikeBlockDescriptor({ id: '[(FormState.x)]' })).toBe(false);
  });

  it('rejects empty id and non-descriptor shapes', () => {
    expect(looksLikeBlockDescriptor({ id: '' })).toBe(false);
    expect(looksLikeBlockDescriptor({ component: 'OnlyComponent' })).toBe(false);
    expect(looksLikeBlockDescriptor({ component: 'C', blockId: 'X' })).toBe(false);
    expect(looksLikeBlockDescriptor(null)).toBe(false);
  });
});

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

  it('is false for nested block descriptors (resolved when the child loads)', () => {
    expect(
      valueNeedsInputResolve({
        rows: [
          {
            component: 'HtmlBlock',
            id: 'WelcomeTitle',
            services: [{ id: 'AmsService' }],
            inputs: {
              html: "{{ ref('AmsService.session.user')['firstName'] }}",
            },
          },
        ],
      }),
    ).toBe(false);
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

  it('valueContainsMustacheInTree ignores mustache inside deferred block descriptors', () => {
    expect(
      valueContainsMustacheInTree({
        component: 'HtmlBlock',
        inputs: { html: '{{ x }}' },
      }),
    ).toBe(false);
  });

  it('valueNeedsInputResolve is true for strings that start a two-way ref', () => {
    expect(valueNeedsInputResolve('[(FormState.x)] extra')).toBe(true);
    expect(valueNeedsInputResolve('grid-rows-[auto_minmax(0,1fr)]')).toBe(false);
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

  it('does not resolve templates inside nested block descriptors', () => {
    const html = "{{ ref('AmsService.session.user')['firstName'] }}";
    const child = {
      component: 'HtmlBlock',
      id: 'WelcomeTitle',
      inputs: { html },
    };
    const ctx = makeCtx(signal('a'));
    const out = resolveNestedTemplateValues({ rows: [child] }, ctx, 'layout', new WeakSet(), {});
    expect((out as { rows: typeof child[] }).rows[0].inputs.html).toBe(html);
  });

  it('treats block references as deferred (blockDefinition templates not resolved on parent)', () => {
    const ref = {
      blockId: 'WelcomeTitle',
      blockDefinition: {
        inputs: { html: "{{ ref('AmsService.session.user') }}" },
      },
    };
    expect(looksLikeBlockDescriptor(ref)).toBe(true);
    expect(shouldDeferInputTemplateResolution(ref)).toBe(true);
    expect(valueNeedsInputResolve({ blocks: [ref] })).toBe(false);
    const ctx = makeCtx(signal('a'));
    const out = resolveNestedTemplateValues({ blocks: [ref] }, ctx, 'inputs', new WeakSet(), {});
    expect((out as { blocks: typeof ref[] }).blocks[0]).toBe(ref);
  });

  it('preserves nested blocks[] trees (ContainerBlock-style)', () => {
    const html = "{{ ref('AmsService.session.user')['firstName'] }}";
    const welcomeTitle = {
      component: 'HtmlBlock',
      id: 'WelcomeTitle',
      services: [{ id: 'AmsService' }],
      inputs: { html, style: { fontSize: '26px' } },
      model: {},
    };
    const headerLeft = {
      component: 'ContainerBlock',
      id: 'HeaderLeft',
      inputs: {
        style: { display: 'flex' },
        blocks: [
          welcomeTitle,
          {
            component: 'ContainerBlock',
            id: 'Segments',
            inputs: { blocks: [{ component: 'HtmlBlock', id: 'X', inputs: { html: '{{ ref("AmsService.x") }}' } }] },
          },
        ],
      },
    };
    const ctx = makeCtx(signal('a'));
    expect(valueNeedsInputResolve(headerLeft.inputs)).toBe(false);
    const out = resolveNestedTemplateValues(headerLeft.inputs, ctx, 'inputs', new WeakSet(), {});
    const blocks = (out as { blocks: typeof welcomeTitle[] }).blocks;
    expect(blocks[0].inputs.html).toBe(html);
    expect(
      (blocks[1] as { inputs: { blocks: { inputs: { html: string } }[] } }).inputs.blocks[0].inputs
        .html,
    ).toContain('AmsService');
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
