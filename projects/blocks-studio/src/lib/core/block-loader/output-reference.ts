import { type OutputReference, isOutputReference } from './block-description.schema';
import type { ResolverContext } from './ref-resolver';
import { getRefValue, getValueByPath, resolveRefPath } from './ref-resolver';
import { evaluateSafeExpression } from './safe-expression-evaluator';

function getCallTarget(reference: string, ctx: ResolverContext): unknown {
  const resolved = resolveRefPath(reference, ctx);
  if (resolved == null) return undefined;
  const { target, path } = resolved;
  if (path.length === 0) return target;
  const parent = target as Record<string, unknown>;
  return parent?.[path[0]];
}

function getMethodOnTarget(target: unknown, methodName: string): ((...args: unknown[]) => unknown) | null {
  if (target == null) return null;
  const m = (target as Record<string, unknown>)[methodName];
  return typeof m === 'function' ? (m as (...args: unknown[]) => unknown) : null;
}

function resolveReferenceValue(ref: string, ctx: ResolverContext): unknown {
  const resolved = resolveRefPath(ref, ctx);
  if (resolved != null) return getRefValue(ref, ctx);
  return getValueByPath(ctx.currentInstance?.model?.() ?? {}, ref);
}

function evaluateExpression(
  expression: string,
  ctx: ResolverContext,
  payload: unknown
): unknown {
  const trimmed = expression.trim();
  if (!trimmed) return undefined;
  try {
    return evaluateSafeExpression(trimmed, ctx, payload, resolveReferenceValue);
  } catch {
    return resolveReferenceValue(trimmed, ctx);
  }
}

function resolveInterpolatedString(value: string, ctx: ResolverContext, payload: unknown): unknown {
  if (!value.includes('{{') || !value.includes('}}')) return value;

  const re = /\{\{([\s\S]*?)\}\}/g;
  const matches = [...value.matchAll(re)];
  if (matches.length === 0) return value;

  // If the whole string is a single interpolation, preserve the original type.
  if (matches.length === 1 && matches[0][0].length === value.trim().length && matches[0][0] === value.trim()) {
    return evaluateExpression(matches[0][1], ctx, payload);
  }

  let out = '';
  let lastIndex = 0;
  for (const match of matches) {
    const start = match.index ?? 0;
    out += value.slice(lastIndex, start);
    const evaluated = evaluateExpression(match[1], ctx, payload);
    out += evaluated != null ? String(evaluated) : '';
    lastIndex = start + match[0].length;
  }
  out += value.slice(lastIndex);
  return out;
}

function resolveOutputParamValue(value: unknown, ctx: ResolverContext, payload: unknown): unknown {
  if (typeof value === 'string') {
    return resolveInterpolatedString(value, ctx, payload);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveOutputParamValue(item, ctx, payload));
  }
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        resolveOutputParamValue(item, ctx, payload),
      ])
    );
  }
  return value;
}

export function resolveOutputReference(
  ref: OutputReference,
  eventValue: unknown,
  ctx: ResolverContext
): (value: unknown) => void {
  return (value: unknown) => {
    const payload = value ?? eventValue;
    const callTarget = getCallTarget(ref.reference, ctx);
    const method = getMethodOnTarget(callTarget, ref.method);
    if (method == null) {
      console.warn(`Output reference ${ref.reference} has no method ${ref.method}`);
      return;
    }
    const params =
      ref.params != null
        ? (Array.isArray(ref.params) ? ref.params : [ref.params]).map((param) =>
            resolveOutputParamValue(param, ctx, payload)
          )
        : [payload];
    const result = method.call(callTarget, ...params);
    if (result != null && typeof (result as Promise<unknown>).then === 'function') {
      (result as Promise<unknown>).then(
        () => runThenOrSuccess(ref, ctx),
        () => runOnError(ref, ctx)
      );
    } else {
      runThenOrSuccess(ref, ctx);
    }
  };
}

function toParams(p: unknown[] | Record<string, unknown> | undefined): unknown[] {
  if (p == null) return [];
  return Array.isArray(p) ? p : [p];
}

function runThenOrSuccess(ref: OutputReference, ctx: ResolverContext): void {
  if (ref.then?.length) {
    for (const step of ref.then) {
      invokeRefMethod(ctx, step.reference, step.method, toParams(step.params));
    }
  } else if (ref.onSuccess) {
    invokeRefMethod(ctx, ref.onSuccess.reference, ref.onSuccess.method, toParams(ref.onSuccess.params));
  }
}

function runOnError(ref: OutputReference, ctx: ResolverContext): void {
  if (ref.onError) {
    invokeRefMethod(ctx, ref.onError.reference, ref.onError.method, toParams(ref.onError.params));
  }
}

function invokeRefMethod(
  ctx: ResolverContext,
  reference: string,
  method: string,
  params: unknown[]
): void {
  const callTarget = getCallTarget(reference, ctx);
  const fn = getMethodOnTarget(callTarget, method);
  if (fn) fn.call(callTarget, ...params);
}

export function createOutputHandler(
  outputValue: unknown,
  outputKey: string,
  ctx: ResolverContext,
  directiveHandlers?: Record<string, (value: unknown) => void>
): (value: unknown) => void {
  if (isOutputReference(outputValue)) {
    return resolveOutputReference(outputValue, undefined, ctx);
  }
  const fromDirective = directiveHandlers?.[outputKey];
  return fromDirective ?? (() => {});
}
