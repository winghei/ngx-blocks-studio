import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import {
  parseFlowTemplate,
  collectRefPaths,
  interpretFlow,
  looksLikeFlowTemplate,
  resolveRefOrModel,
} from '../../projects/blocks-studio/src/lib/core/block-loader/flow-template';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';
import type { ResolverContext } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';

function ctx(): ResolverContext {
  const registry = new BlockRegistryImpl();
  return {
    registry,
    currentInstance: {
      model: signal({ label: 'M', flag: 'false' }),
      services: { S: { items: ['a', 'b'] } },
    },
  };
}

describe('parseFlowTemplate', () => {
  it('parses refs and text', () => {
    const nodes = parseFlowTemplate('Hello ${model.label}!');
    expect(nodes).toEqual([
      { type: 'text', value: 'Hello ' },
      { type: 'ref', refPath: 'model.label' },
      { type: 'text', value: '!' },
    ]);
  });

  it('parses @if with @else', () => {
    const nodes = parseFlowTemplate('@if (model.label) { yes } @else { no }');
    expect(nodes[0].type).toBe('if');
    const ifNode = nodes[0] as { elseBody?: unknown[] };
    expect(ifNode.elseBody?.length).toBeGreaterThan(0);
  });

  it('parses @for loop', () => {
    const nodes = parseFlowTemplate('@for (item of S.items) { ${item} }');
    expect(nodes[0]).toMatchObject({ type: 'for', itemVar: 'item', refPath: 'S.items' });
  });

  it('parses @if/@else with extra whitespace before braces', () => {
    const nodes = parseFlowTemplate('@if (model.label)  { yes } @else   { no }');
    expect(nodes[0].type).toBe('if');
  });

  it('advances one character when @if prefix lacks an opening paren', () => {
    const nodes = parseFlowTemplate('a@if x');
    expect(nodes[0]).toEqual({ type: 'text', value: 'a' });
    expect(nodes[1]).toEqual({ type: 'text', value: '@' });
  });

  it('falls back to text on malformed @if', () => {
    expect(parseFlowTemplate('@if (unclosed')).toEqual([{ type: 'text', value: '@if (unclosed' }]);
    expect(parseFlowTemplate('@if (x) notbrace')).toEqual([
      { type: 'text', value: '@if (x) notbrace' },
    ]);
  });

  it('falls back on malformed @for', () => {
    expect(parseFlowTemplate('@for (bad syntax) {')).toEqual([
      { type: 'text', value: '@for (bad syntax) {' },
    ]);
    expect(parseFlowTemplate('@for (x of list) nobrace')).toEqual([
      { type: 'text', value: '@for (x of list) nobrace' },
    ]);
  });

  it('collectRefPaths walks tree', () => {
    const nodes = parseFlowTemplate('@if (a) { ${b} } @else { ${c} }');
    const paths = collectRefPaths(nodes);
    expect(paths.has('a')).toBe(true);
    expect(paths.has('b')).toBe(true);
    expect(paths.has('c')).toBe(true);
  });
});

describe('interpretFlow', () => {
  it('escapes ref values for HTML', () => {
    const c = ctx();
    c.currentInstance!.model = signal({ label: '<script>' });
    const out = interpretFlow(parseFlowTemplate('${model.label}'), c);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;');
  });

  it('skips escape when escapeRefValues is false', () => {
    const c = ctx();
    c.currentInstance!.model = signal({ label: '<b>' });
    const out = interpretFlow(parseFlowTemplate('${model.label}'), c, {}, { escapeRefValues: false });
    expect(out).toBe('<b>');
  });

  it('uses scope for ref first segment', () => {
    const nodes = parseFlowTemplate('${item}');
    const out = interpretFlow(nodes, ctx(), { item: 'scoped' });
    expect(out).toBe('scoped');
  });

  it('runs @if / @else with falsy string conditions', () => {
    const c = ctx();
    const tpl = '@if (model.flag) { yes } @else { no }';
    expect(interpretFlow(parseFlowTemplate(tpl), c).trim()).toBe('no');
  });

  it('does not render @else body when it parses empty', () => {
    const c = ctx();
    const tpl = '@if (model.flag) { yes } @else { }';
    expect(interpretFlow(parseFlowTemplate(tpl), c).trim()).toBe('');
  });

  it('renders @else branch when condition is falsy', () => {
    const c = ctx();
    const tpl = '@if (model.flag) { yes } @else { NO }';
    expect(interpretFlow(parseFlowTemplate(tpl), c)).toContain('NO');
  });

  it('executes @for over array values', () => {
    const out = interpretFlow(
      parseFlowTemplate('@for (item of S.items) { ${item} }'),
      ctx(),
    );
    expect(out.replace(/\s/g, '')).toBe('ab');
  });

  it('uses custom resolveCondition', () => {
    const nodes = parseFlowTemplate('@if (expr) { T }');
    const out = interpretFlow(nodes, ctx(), {}, {
      resolveCondition: (expr) => expr === 'expr',
    });
    expect(out).toBe(' T ');
  });

  it('iterates @for over non-array as empty', () => {
    const c = ctx();
    c.currentInstance!.services = { S: { items: null } };
    const out = interpretFlow(parseFlowTemplate('@for (x of S.items) { X }'), c);
    expect(out).toBe('');
  });

  it('interpolates text via interpolateText option', () => {
    const nodes = parseFlowTemplate('prefix');
    const out = interpretFlow(nodes, ctx(), {}, {
      interpolateText: (s) => s.replace('prefix', '1'),
    });
    expect(out).toBe('1');
  });
});

describe('looksLikeFlowTemplate', () => {
  it('detects flow syntax', () => {
    expect(looksLikeFlowTemplate('@if (a) {}')).toBe(true);
    expect(looksLikeFlowTemplate('${x}')).toBe(true);
    expect(looksLikeFlowTemplate('plain')).toBe(false);
  });
});

describe('resolveRefOrModel', () => {
  it('resolves ref or model path', () => {
    expect(resolveRefOrModel('S.items', ctx())).toEqual(['a', 'b']);
    expect(resolveRefOrModel('label', ctx())).toBe('M');
    expect(resolveRefOrModel('', ctx())).toBeUndefined();
  });

  it('falls back to model when ref path does not resolve as service', () => {
    const c: ResolverContext = {
      registry: new BlockRegistryImpl(),
      currentInstance: { model: signal(undefined), services: {} },
    };
    expect(resolveRefOrModel('onlyOnModel', c)).toBeUndefined();
  });
});

describe('escapeHtml without element', () => {
  it('uses string replace when document.createElement returns null', () => {
    const orig = document.createElement;
    vi.spyOn(document, 'createElement').mockReturnValue(null as unknown as HTMLDivElement);
    const out = interpretFlow(
      parseFlowTemplate('${model.label}'),
      { ...ctx(), currentInstance: { model: signal({ label: '&' }), services: {} } },
    );
    expect(out).toContain('&amp;');
    document.createElement = orig;
  });
});
