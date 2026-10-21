import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import {
  resolveReferenceValue,
  evaluateExpression,
  resolveMustacheInterpolatedString,
  mustacheSegmentToString,
  resolveTemplateString,
  looksLikeFlowTemplate,
} from '../../projects/blocks-studio/src/lib/core/block-loader/template-interpolation';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';
import type { ResolverContext } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';

function ctx(): ResolverContext {
  return {
    registry: new BlockRegistryImpl(),
    currentInstance: {
      model: signal({ title: 'Hello' }),
      services: { S: { label: signal('Svc') } },
    },
  };
}

describe('template-interpolation', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('resolveReferenceValue uses ref or model fallback', () => {
    expect(resolveReferenceValue('S.label', ctx())).toBe('Svc');
    expect(resolveReferenceValue('title', ctx())).toBe('Hello');
  });

  it('evaluateExpression falls back to ref path on parse error', () => {
    expect(evaluateExpression('title', ctx(), null)).toBe('Hello');
    expect(evaluateExpression('', ctx(), null)).toBeUndefined();
    expect(evaluateExpression('S.count', ctx(), null)).toBeUndefined();
  });

  it('resolveMustacheInterpolatedString returns value when no mustache', () => {
    expect(resolveMustacheInterpolatedString('plain', ctx(), null)).toBe('plain');
  });

  it('preserves type for single full mustache', () => {
    const v = resolveMustacheInterpolatedString("{{ ref('S.label') }}", ctx(), null);
    expect(v).toBe('Svc');
  });

  it('concatenates mixed mustache segments and null values', () => {
    const c = ctx();
    c.currentInstance!.model = signal({ title: 'Hello', empty: null });
    expect(resolveMustacheInterpolatedString('Hi {{ title }}!', c, null)).toBe('Hi Hello!');
    expect(resolveMustacheInterpolatedString('a{{ empty }}b', c, null)).toBe('ab');
    expect(resolveReferenceValue('title', c)).toBe('Hello');
  });

  it('warns when too many mustache segments', () => {
    const many = Array.from({ length: 201 }, (_, i) => `{{ title }}${i}`).join('');
    resolveMustacheInterpolatedString(many, ctx(), null);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('truncating'));
  });

  it('mustacheSegmentToString stringifies non-string evaluated values', () => {
    const c = ctx();
    c.currentInstance!.services = { S: { n: signal(5) } };
    expect(mustacheSegmentToString("{{ ref('S.n') }}", c, null)).toBe('5');
  });

  it('mustacheSegmentToString coerces values', () => {
    expect(mustacheSegmentToString('x', ctx(), null)).toBe('x');
    expect(mustacheSegmentToString('{{ title }}', ctx(), null)).toBe('Hello');
  });

  it('resolveTemplateString uses flow when detected', () => {
    const out = resolveTemplateString('${model.title}', ctx(), null);
    expect(out).toBe('Hello');
  });

  it('resolveTemplateString escapeFlowRefs false', () => {
    const c = ctx();
    c.currentInstance!.model = signal({ title: '<t>' });
    const out = resolveTemplateString('${model.title}', c, null, { escapeFlowRefs: false });
    expect(out).toBe('<t>');
  });

  it('resolveTemplateString runs flow branch with @if', () => {
    const c = ctx();
    c.currentInstance!.model = signal({ show: true, label: 'Hi' });
    const out = resolveTemplateString('@if (show) { ${model.label} }', c, null);
    expect(out).toContain('Hi');
  });

  it('resolveTemplateString uses mustache path when not flow', () => {
    expect(resolveTemplateString('{{ title }}', ctx(), null)).toBe('Hello');
  });

  it('re-exports looksLikeFlowTemplate', () => {
    expect(looksLikeFlowTemplate('${x}')).toBe(true);
  });
});
