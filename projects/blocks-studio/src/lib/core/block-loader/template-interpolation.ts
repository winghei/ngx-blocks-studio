import { interpretFlow, looksLikeFlowTemplate, parseFlowTemplate } from './flow-template';

export { looksLikeFlowTemplate };
import type { ResolverContext } from './ref-resolver';
import { getRefValue, getValueByPath, resolveRefPath } from './ref-resolver';
import { evaluateSafeExpression } from './safe-expression-evaluator';

const MUSTACHE_MAX_SEGMENTS = 200;

export function resolveReferenceValue(ref: string, ctx: ResolverContext): unknown {
  const resolved = resolveRefPath(ref, ctx);
  if (resolved != null) return getRefValue(ref, ctx);
  return getValueByPath(ctx.currentInstance?.model?.() ?? {}, ref);
}

/**
 * Safe expression evaluation (same as output `{{ }}` / `@if (...)` when used with this module).
 * Falls back to `resolveReferenceValue` if parsing fails (treat whole string as a ref path).
 */
export function evaluateExpression(
  expression: string,
  ctx: ResolverContext,
  payload: unknown,
): unknown {
  const trimmed = expression.trim();
  if (!trimmed) return undefined;
  try {
    return evaluateSafeExpression(trimmed, ctx, payload, resolveReferenceValue);
  } catch {
    return resolveReferenceValue(trimmed, ctx);
  }
}

/**
 * Resolves only `{{ … }}` segments via `evaluateExpression`.
 * Single full-string `{{ expr }}` preserves the evaluated type; mixed templates return a string.
 */
export function resolveMustacheInterpolatedString(
  value: string,
  ctx: ResolverContext,
  payload: unknown,
): unknown {
  if (!value.includes('{{') || !value.includes('}}')) return value;

  const re = /\{\{([\s\S]*?)\}\}/g;
  const matches = [...value.matchAll(re)];
  if (matches.length === 0) return value;
  if (matches.length > MUSTACHE_MAX_SEGMENTS) {
    console.warn(
      `Template has more than ${MUSTACHE_MAX_SEGMENTS} mustache segments; truncating interpolation.`,
    );
  }
  const limited = matches.slice(0, MUSTACHE_MAX_SEGMENTS);

  if (
    limited.length === 1 &&
    limited[0][0].length === value.trim().length &&
    limited[0][0] === value.trim()
  ) {
    return evaluateExpression(limited[0][1], ctx, payload);
  }

  let out = '';
  let lastIndex = 0;
  for (const match of limited) {
    const start = match.index ?? 0;
    out += value.slice(lastIndex, start);
    const evaluated = evaluateExpression(match[1], ctx, payload);
    out += evaluated != null ? String(evaluated) : '';
    lastIndex = start + match[0].length;
  }
  out += value.slice(lastIndex);
  return out;
}

export function mustacheSegmentToString(
  segment: string,
  ctx: ResolverContext,
  payload: unknown,
): string {
  const v = resolveMustacheInterpolatedString(segment, ctx, payload);
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

export interface ResolveTemplateStringOptions {
  /**
   * When true (default), `${…}` in flow output is HTML-escaped (block / innerHTML-friendly).
   * Set false for plain strings (e.g. output handler method params).
   */
  escapeFlowRefs?: boolean;
}

/**
 * Unified template resolution: flow (`@if`, `@for`, `${}`) plus `{{ }}` in flow text segments.
 * `@if` conditions use `evaluateExpression` (safe expressions + ref fallback).
 */
export function resolveTemplateString(
  value: string,
  ctx: ResolverContext,
  payload: unknown = undefined,
  options?: ResolveTemplateStringOptions,
): unknown {
  const escapeFlowRefs = options?.escapeFlowRefs !== false;

  if (looksLikeFlowTemplate(value)) {
    return interpretFlow(parseFlowTemplate(value), ctx, {}, {
      escapeRefValues: escapeFlowRefs,
      resolveCondition: (expr) => evaluateExpression(expr, ctx, payload),
      interpolateText: (segment) => mustacheSegmentToString(segment, ctx, payload),
    });
  }
  return resolveMustacheInterpolatedString(value, ctx, payload);
}
