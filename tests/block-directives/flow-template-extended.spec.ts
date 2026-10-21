import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import {
  parseFlowTemplate,
  interpretFlow,
  collectRefPaths,
} from '../../projects/blocks-studio/src/lib/core/block-loader/flow-template';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';

describe('flow-template extended', () => {
  const ctx = () => ({
    registry: new BlockRegistryImpl(),
    currentInstance: {
      model: signal({ items: [1, 2], nested: { label: 'L' } }),
      services: { S: { ok: true } },
    },
  });

  it('parses @if with @else not followed by brace as text', () => {
    const nodes = parseFlowTemplate('@if (S.ok) { y } @else plain');
    expect(nodes[0].type).toBe('if');
  });

  it('collects refs from for-loop bodies', () => {
    const nodes = parseFlowTemplate('@for (i of model.items) { ${i} }');
    const paths = collectRefPaths(nodes);
    expect(paths.has('model.items')).toBe(true);
  });

  it('interpretFlow resolves scoped nested paths', () => {
    const nodes = parseFlowTemplate('${nested.label}');
    const out = interpretFlow(nodes, ctx(), { nested: { label: 'scoped' } });
    expect(out).toBe('scoped');
  });

  it('parse handles unclosed if body brace', () => {
    const nodes = parseFlowTemplate('@if (S.ok) { unclosed');
    expect(nodes[0].type).toBe('text');
  });

  it('parse handles for with unclosed paren', () => {
    const nodes = parseFlowTemplate('@for (x of list');
    expect(nodes[0].type).toBe('text');
  });

  it('parse handles unclosed for body brace', () => {
    const nodes = parseFlowTemplate('@for (x of model.items) { bad');
    expect(nodes[0].type).toBe('text');
  });

  it('interpretFlow treats empty string condition as falsy', () => {
    const c = ctx();
    c.currentInstance!.model = signal({ empty: '   ' });
    const out = interpretFlow(parseFlowTemplate('@if (empty) { y } @else { n }'), c);
    expect(out.trim()).toBe('n');
  });

  it('interpretFlow treats non-empty string condition as truthy', () => {
    const c = ctx();
    c.currentInstance!.model = signal({ status: 'hello' });
    const out = interpretFlow(parseFlowTemplate('@if (status) { yes } @else { no }'), c);
    expect(out.trim()).toBe('yes');
  });

  it('interpretFlow uses model-only refs and else branch with custom condition', () => {
    const c = ctx();
    c.currentInstance!.services = {};
    expect(interpretFlow(parseFlowTemplate('${nested.label}'), c)).toBe('L');
    const nodes = parseFlowTemplate('@if (missing) { yes } @else { nope }');
    expect(
      interpretFlow(nodes, c, {}, { resolveCondition: () => false }),
    ).toContain('nope');
  });

  it('parseFlowTemplate advances one character when @ is not a flow block', () => {
    const nodes = parseFlowTemplate('x@if (a) { y }');
    expect(nodes[0]).toEqual({ type: 'text', value: 'x' });
    expect(nodes.some((n) => n.type === 'if')).toBe(true);
  });

  it('parseFlowTemplate skips whitespace after @else before brace', () => {
    const nodes = parseFlowTemplate('@if (S.ok) { a } @else   { b }');
    expect(nodes[0].type).toBe('if');
  });

  it('interpretFlow skips for body when ref is not an array', () => {
    const c = ctx();
    c.currentInstance!.model = signal({ items: 'not-array' });
    expect(interpretFlow(parseFlowTemplate('@for (i of model.items) { x }'), c)).toBe('');
  });

  it('interpretFlow runs for-loop body with $index in scope', () => {
    const tpl = '@for (n of model.items) { ${n} }';
    expect(interpretFlow(parseFlowTemplate(tpl), ctx()).replace(/\s/g, '')).toBe('12');
  });
});
