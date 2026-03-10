import { type OutputReference, isOutputReference } from './block-description.schema';
import type { ResolverContext } from './ref-resolver';
import { resolveRefPath } from './ref-resolver';

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
    const params = ref.params != null
      ? (Array.isArray(ref.params) ? ref.params : [ref.params])
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
