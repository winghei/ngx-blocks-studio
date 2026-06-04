import type { OutputCallObject } from './block-description.schema';
import { isOutputCallObject } from './block-description.schema';
import type { ResolverContext } from './ref-resolver';
import { resolveRefPath } from './ref-resolver';
import { resolveTemplateString } from './template-interpolation';

function getCallTarget(reference: string, ctx: ResolverContext): unknown {
  const resolved = resolveRefPath(reference, ctx);
  if (resolved == null) return undefined;
  const { target, path } = resolved;
  if (path.length === 0) return target;
  const parent = target as Record<string, unknown>;
  return parent?.[path[0]];
}

function resolveReferencePath(reference: string, ctx: ResolverContext, payload: unknown): string {
  const resolved = resolveTemplateString(reference, ctx, payload, { escapeFlowRefs: false });
  return typeof resolved === 'string' ? resolved : String(resolved ?? '');
}

/**
 * Split `Block:path.to.method` or `service.path.method` (current block) into ref path + method name.
 * Last dot-separated segment after `:` is the method; before that is the ref path.
 */
export function splitCallableRef(fullPath: string): { refPath: string; method: string } | null {
  const trimmed = fullPath.trim();
  if (!trimmed) return null;
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx !== -1) {
    const prefix = trimmed.slice(0, colonIdx).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();
    const parts = rest.split('.').filter(Boolean);
    if (parts.length < 2) return null;
    const method = parts[parts.length - 1]!;
    const parentRest = parts.slice(0, -1).join('.');
    return { refPath: `${prefix}:${parentRest}`, method };
  }
  const parts = trimmed.split('.').filter(Boolean);
  if (parts.length < 2) return null;
  const method = parts[parts.length - 1]!;
  const refPath = parts.slice(0, -1).join('.');
  return { refPath, method };
}

function getMethodOnTarget(
  target: unknown,
  methodName: string,
): ((...args: unknown[]) => unknown) | null {
  if (target == null) return null;
  const m = (target as Record<string, unknown>)[methodName];
  return typeof m === 'function' ? (m as (...args: unknown[]) => unknown) : null;
}

function warnNotCallable(
  resolvedFullRef: string,
  refPath: string,
  method: string,
  callTarget: unknown,
): void {
  const leafDesc =
    callTarget != null && typeof callTarget === 'object'
      ? typeof (callTarget as Record<string, unknown>)[method]
      : 'n/a';
  console.warn(
    `Output call "${resolvedFullRef}": "${method}" is not a callable function ` +
      `(ref path "${refPath}"); resolved leaf type: ${leafDesc}.`,
  );
}

function resolveOutputParamValue(value: unknown, ctx: ResolverContext, payload: unknown): unknown {
  if (typeof value === 'string') {
    return resolveTemplateString(value, ctx, payload, { escapeFlowRefs: false });
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveOutputParamValue(item, ctx, payload));
  }

  if (value != null && typeof value === 'object' && !('component' in value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        resolveOutputParamValue(item, ctx, payload),
      ]),
    );
  }

  return value;
}

function isTruthyOutputCondition(value: unknown): boolean {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false;
    }
    return true;
  }
  return !!value;
}

function shouldRunWhen(when: unknown, ctx: ResolverContext, payload: unknown): boolean {
  if (when == null) return true;
  const resolved = resolveOutputParamValue(when, ctx, payload);
  return isTruthyOutputCondition(resolved);
}

type CallableExtras = Pick<OutputCallObject, 'when' | 'params' | 'then' | 'onError'>;

function buildOutputHandlerFromCall(
  refTemplate: string,
  extras: CallableExtras,
  ctx: ResolverContext,
  eventValue: unknown,
): (value: unknown) => void {
  const def: OutputCallObject = { ref: refTemplate, ...extras };
  return (value: unknown) => {
    const payload = value ?? eventValue;
    if (!shouldRunWhen(def.when, ctx, payload)) {
      return;
    }
    const resolvedCallable = resolveReferencePath(refTemplate, ctx, payload);
    const split = splitCallableRef(resolvedCallable);
    if (split == null) {
      console.warn(
        `Invalid output callable ref "${resolvedCallable}" (expected e.g. Block:path.method or service.path.method)`,
      );
      return;
    }
    const { refPath, method } = split;
    const callTarget = getCallTarget(refPath, ctx);
    const fn = getMethodOnTarget(callTarget, method);
    if (fn == null) {
      warnNotCallable(resolvedCallable, refPath, method, callTarget);
      return;
    }

    const params =
      def.params != null
        ? (Array.isArray(def.params) ? def.params : [def.params]).map((param) =>
            resolveOutputParamValue(param, ctx, payload),
          )
        : [payload];

    const result = fn.call(callTarget, ...params);
    if (result != null && typeof (result as Promise<unknown>).then === 'function') {
      (result as Promise<unknown>).then(
        () => runThenOrSuccess(def, ctx, payload),
        () => runOnError(def, ctx, payload),
      );
    } else {
      runThenOrSuccess(def, ctx, payload);
    }
  };
}

function resolveStepParams(
  p: unknown[] | Record<string, unknown> | undefined,
  ctx: ResolverContext,
  payload: unknown,
): unknown[] {
  if (p == null) return [];
  const arr = Array.isArray(p) ? p : [p];
  return arr.map((item) => resolveOutputParamValue(item, ctx, payload));
}

function runThenOrSuccess(def: OutputCallObject, ctx: ResolverContext, payload: unknown): void {
  if (def.then?.length) {
    runThenChain(def.then, 0, ctx, def, payload, () => {});
  }
}

function runThenChain(
  steps: NonNullable<OutputCallObject['then']>,
  index: number,
  ctx: ResolverContext,
  parentDef: OutputCallObject,
  payload: unknown,
  onComplete: () => void,
): void {
  if (index >= steps.length) {
    onComplete();
    return;
  }
  const step = steps[index];
  const runNextSibling = () => runThenChain(steps, index + 1, ctx, parentDef, payload, onComplete);

  const refTemplate = typeof step === 'string' ? step : step.ref;
  const when = typeof step === 'string' ? undefined : step.when;
  const stepParams = typeof step === 'string' ? undefined : step.params;
  const nestedThen = typeof step === 'string' ? undefined : step.then;

  if (!shouldRunWhen(when, ctx, payload)) {
    runNextSibling();
    return;
  }

  const resolvedCallable = resolveReferencePath(refTemplate, ctx, payload);
  const split = splitCallableRef(resolvedCallable);
  if (split == null) {
    console.warn(
      `then chain: invalid callable ref "${resolvedCallable}" (expected e.g. Block:path.method)`,
    );
    return;
  }
  const { refPath, method } = split;
  const callTarget = getCallTarget(refPath, ctx);
  const fn = getMethodOnTarget(callTarget, method);
  if (fn == null) {
    warnNotCallable(resolvedCallable, refPath, method, callTarget);
    return;
  }
  const params = resolveStepParams(stepParams, ctx, payload);
  const result = fn.call(callTarget, ...params);
  const afterStep = () => {
    if (nestedThen?.length) {
      runThenChain(nestedThen, 0, ctx, parentDef, payload, runNextSibling);
    } else {
      runNextSibling();
    }
  };
  if (result != null && typeof (result as Promise<unknown>).then === 'function') {
    (result as Promise<unknown>).then(afterStep, () => runOnError(parentDef, ctx, payload));
  } else {
    afterStep();
  }
}

function runOnError(def: OutputCallObject, ctx: ResolverContext, payload: unknown): void {
  if (def.onError && shouldRunWhen(def.onError.when, ctx, payload)) {
    invokeRefMethod(
      ctx,
      def.onError.ref,
      payload,
      resolveStepParams(def.onError.params, ctx, payload),
    );
  }
}

function invokeRefMethod(
  ctx: ResolverContext,
  refTemplate: string,
  payload: unknown,
  params: unknown[],
): void {
  const resolvedCallable = resolveReferencePath(refTemplate, ctx, payload);
  const split = splitCallableRef(resolvedCallable);
  if (split == null) {
    console.warn(`onError: invalid callable ref "${resolvedCallable}"`);
    return;
  }
  const { refPath, method } = split;
  const callTarget = getCallTarget(refPath, ctx);
  const fn = getMethodOnTarget(callTarget, method);
  if (fn == null) {
    warnNotCallable(resolvedCallable, refPath, method, callTarget);
    return;
  }
  fn.call(callTarget, ...params);
}

export function createOutputHandler(
  outputValue: unknown,
  _outputKey: string,
  ctx: ResolverContext,
): (value: unknown) => void {
  if (typeof outputValue === 'string') {
    return buildOutputHandlerFromCall(outputValue, {}, ctx, undefined);
  }
  if (isOutputCallObject(outputValue)) {
    return buildOutputHandlerFromCall(outputValue.ref, outputValue, ctx, undefined);
  }
  return () => {};
}
