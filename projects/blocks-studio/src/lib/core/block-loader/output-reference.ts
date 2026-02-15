import type { BlockRegistry } from './block-registry';
import { type OutputReference, isOutputReference } from './block-description.schema';
import { resolveRefPath } from './ref-resolver';

function getCallTarget(
  reference: string,
  registry: BlockRegistry
): unknown {
  const resolved = resolveRefPath(reference, { registry });
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
  registry: BlockRegistry
): (value: unknown) => void {
  return (value: unknown) => {
    const payload = value ?? eventValue;
    const callTarget = getCallTarget(ref.reference, registry);
    const method = getMethodOnTarget(callTarget, ref.method);
    if (method == null) return;
    const params = ref.params != null
      ? (Array.isArray(ref.params) ? ref.params : [ref.params])
      : [payload];
    const result = method.call(callTarget, ...params);
    if (result != null && typeof (result as Promise<unknown>).then === 'function') {
      (result as Promise<unknown>).then(
        () => runThenOrSuccess(ref, registry),
        () => runOnError(ref, registry)
      );
    } else {
      runThenOrSuccess(ref, registry);
    }
  };
}

function toParams(p: unknown[] | Record<string, unknown> | undefined): unknown[] {
  if (p == null) return [];
  return Array.isArray(p) ? p : [p];
}

function runThenOrSuccess(ref: OutputReference, registry: BlockRegistry): void {
  if (ref.then?.length) {
    for (const step of ref.then) {
      invokeRefMethod(registry, step.reference, step.method, toParams(step.params));
    }
  } else if (ref.onSuccess) {
    invokeRefMethod(registry, ref.onSuccess.reference, ref.onSuccess.method, toParams(ref.onSuccess.params));
  }
}

function runOnError(ref: OutputReference, registry: BlockRegistry): void {
  if (ref.onError) {
    invokeRefMethod(registry, ref.onError.reference, ref.onError.method, toParams(ref.onError.params));
  }
}

function invokeRefMethod(
  registry: BlockRegistry,
  reference: string,
  method: string,
  params: unknown[]
): void {
  const callTarget = getCallTarget(reference, registry);
  const fn = getMethodOnTarget(callTarget, method);
  if (fn) fn.call(callTarget, ...params);
}

export function createOutputHandler(
  outputValue: unknown,
  outputKey: string,
  registry: BlockRegistry,
  directiveHandlers?: Record<string, (value: unknown) => void>
): (value: unknown) => void {
  if (isOutputReference(outputValue)) {
    return resolveOutputReference(outputValue, undefined, registry);
  }
  const fromDirective = directiveHandlers?.[outputKey];
  return fromDirective ?? (() => {});
}
