import { computed, isSignal, signal, type Signal } from '@angular/core';
import type { BlockRegistry, CurrentInstance } from './block-registry';
import { parseRefPath } from './ref-expressions';

export interface ResolverContext {
  registry: BlockRegistry;
  /** Current block's full id (nearest block with id). */
  currentBlockId?: string;
  /** Current block's instance (services/state by name). */
  currentInstance?: CurrentInstance;
  /** Optional scope-key → registry lookup for explicit `ScopeKey/BlockId:...` refs. */
  getRegistryForScope?: (scopeKey: string) => BlockRegistry | null;
}

const WARN_CACHE_MAX = 200;
const warnCache = new Set<string>();
function warnOnce(msg: string): void {
  if (warnCache.has(msg)) return;
  if (warnCache.size >= WARN_CACHE_MAX) warnCache.clear();
  warnCache.add(msg);
  console.warn(msg);
}

/**
 * Resolve a ref path to the target object and path.
 * Path format: "model.info.title" (current block) or "BlockID:model.info.title" (named block).
 * First segment after the optional BlockID: is the service/model name; the rest is the property path.
 * Single-segment refs (e.g. "age") return null so interpolation falls back to model path.
 */
export function resolveRefPath(
  refPath: string,
  ctx: ResolverContext,
): { target: unknown; path: string[] } | null {
  const parsed = parseRefPath(refPath);
  const { scopeKey, blockId, serviceOrModel, pathParts } = parsed;

  if (!serviceOrModel) {
    return null;
  }

  const registry =
    scopeKey != null
      ? (ctx.getRegistryForScope?.(scopeKey) ?? null)
      : ctx.registry;
  if (scopeKey != null && registry == null) {
    warnOnce(`Ref "${refPath}" could not resolve scope "${scopeKey}".`);
    return null;
  }

  let instance: CurrentInstance | undefined;
  if (blockId != null) {
    // Allow self-references during load before the current block is registered.
    // Important: only shortcut when there is no explicit scope. Scoped refs must resolve through that scope's registry.
    if (
      scopeKey == null &&
      ctx.currentBlockId != null &&
      blockId === ctx.currentBlockId &&
      ctx.currentInstance != null
    ) {
      instance = ctx.currentInstance;
    } else {
      const handle = (registry ?? ctx.registry).get(blockId);
      if (!handle) {
        warnOnce(`Ref "${refPath}" could not resolve block id "${blockId}".`);
        return null;
      }
      instance = handle.instance;
    }
  } else {
    instance = ctx.currentInstance ?? undefined;
  }

  if (instance == null) return null;

  // Special-case: `model` refers to the instance model signal (not a service).
  if (serviceOrModel === 'model') {
    const base = instance.model;
    if (!base) {
      warnOnce(`Ref "${refPath}" could not resolve model (no instance model).`);
      return null;
    }
    if (pathParts.length === 0) {
      return { target: base, path: [] };
    }
    let current: unknown = base;
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (current != null && isSignal(current)) {
        current = (current as Signal<unknown>)();
      }
      if (current == null || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[pathParts[i]];
    }
    return { target: current, path: pathParts.slice(-1) };
  }

  const service = instance.services?.[serviceOrModel];

  // If the named service/model is not present on the instance, fall back to `model.<serviceOrModel>...`
  // (e.g. `Kanban:title` -> `Kanban.model.title`) but only for named-block refs.
  const shouldModelFallback = blockId != null && service == null && instance.model != null;
  const base = shouldModelFallback ? instance.model : service;
  const effectiveParts = shouldModelFallback ? [serviceOrModel, ...pathParts] : pathParts;

  if (!base) {
    warnOnce(`Ref "${refPath}" could not resolve service/model "${serviceOrModel}".`);
    return null;
  }
  if (effectiveParts.length === 0) {
    return { target: base, path: [] };
  }

  let current: unknown = base;

  for (let i = 0; i < effectiveParts.length - 1; i++) {
    // Unwrap signals at each segment so model.item.a works even when
    // model or item are signals.
    if (current != null && isSignal(current)) {
      current = (current as Signal<unknown>)();
    }
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[effectiveParts[i]];
  }

  // Do not unwrap the final segment here; leave it to getRefValue / setRefValue so they
  // can consistently handle signals and functions at the leaf.
  return { target: current, path: effectiveParts.slice(-1) };
}

/**
 * Get a value from an object by dot-notation path (e.g. "name.firstName" -> obj.name?.firstName).
 * Returns undefined if any segment is null/undefined or not an object.
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  const parts = path.trim().split('.').filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Return true if the value at ref path is an Angular signal (so reading it in an effect would be reactive).
 */
export function refPathResolvesToSignal(refPath: string, ctx: ResolverContext): boolean {
  const resolved = resolveRefPath(refPath, ctx);
  if (resolved == null) return false;
  const val =
    resolved.path.length === 0
      ? resolved.target
      : (resolved.target as Record<string, unknown>)?.[resolved.path[0]];
  return val != null && isSignal(val);
}

/**
 * Get value at ref path (read-only). Returns undefined if not found.
 * When target is a Signal (e.g. model) and path has segments, unwraps the Signal first
 * so refs like PersonForm:model.firstName resolve correctly.
 */
export function getRefValue(refPath: string, ctx: ResolverContext): unknown {
  const resolved = resolveRefPath(refPath, ctx);

  if (resolved == null || resolved.path.length === 0) {
    return resolved?.target;
  }

  let obj: unknown = resolved.target;
  // Unwrap Signal so we can read properties (e.g. PersonForm:model.firstName)
  if (obj != null && isSignal(obj)) {
    obj = (obj as Signal<unknown>)();
  }
  const key = resolved.path[0];
  const val = (obj as Record<string, unknown>)?.[key];
  if (val != null && isSignal(val)) {
    return val();
  }
  if (typeof val === 'function') {
    return (val as () => unknown)();
  }
  return val;
}

export function getRefSignal(refPath: string, ctx: ResolverContext): Signal<unknown> | undefined {
  const resolved = resolveRefPath(refPath, ctx);

  if (resolved == null) return undefined;

  let value: unknown;
  if (resolved.path.length === 0) {
    value = resolved.target;
  } else {
    if (isSignal(resolved.target)) {
      const signalValue = resolved.target();

      value =
        signalValue != null && typeof signalValue === 'object'
          ? (signalValue as Record<string, unknown>)[resolved.path[0]]
          : undefined;
    } else {
      value = (resolved.target as Record<string, unknown>)?.[resolved.path[0]];
    }
  }

  return value != null && isSignal(value) ? (value as Signal<unknown>) : undefined;
}

/**
 * Set value at ref path (write). No-op if target is not writable.
 */
export function setRefValue(refPath: string, ctx: ResolverContext, value: unknown): void {
  const resolved = resolveRefPath(refPath, ctx);
  if (resolved == null || resolved.path.length === 0) return;
  const obj = resolved.target as Record<string, unknown>;
  const key = resolved.path[0];
  const val = obj?.[key];
  // use isSignal so we only treat real signals as writable
  type WritableSignalLike = { set: (v: unknown) => void };
  const writable =
    val != null && isSignal(val) && typeof (val as unknown as WritableSignalLike).set === 'function'
      ? (val as unknown as WritableSignalLike)
      : null;
  if (writable) {
    writable.set(value);
  } else if (obj != null && typeof obj === 'object') {
    (obj as Record<string, unknown>)[key] = value;
  }
}

/**
 * Build a computed signal for a template string with {{refPath}} placeholders.
 */
export function buildComputedForTemplate(
  template: string,
  refPaths: string[],
  ctx: ResolverContext,
): Signal<string> {
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return computed(() => {
    let out = template;
    for (const refPath of refPaths) {
      const val = getRefValue(refPath, ctx);
      const str = val != null ? String(val) : '';
      out = out.replace(new RegExp(`\\{\\{${escapeRe(refPath)}\\}\\}`, 'g'), str);
    }
    return out;
  });
}
