import { computed, isSignal, type Signal } from '@angular/core';
import type { BlockRegistry, CurrentInstance } from './block-registry';
import { parseRefPath } from './ref-expressions';


export interface ResolverContext {
  registry: BlockRegistry;
  /** Current block's full id (nearest block with id). */
  currentBlockId?: string;
  /** Current block's instance (services/state by name). */
  currentInstance?: CurrentInstance;
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
  const { blockId, serviceOrModel, pathParts } = parsed;

  if (!serviceOrModel) {
    return null;
  }

  let instance: CurrentInstance | undefined;
  if (blockId != null) {
    const handle = ctx.registry.get(blockId);
    if (!handle) return null;
    instance = handle.instance;
  } else {
    instance = ctx.currentInstance ?? undefined;
  }
  if (instance == null) return null;


  const service = instance[serviceOrModel];
  if (!service) return null;
  if (pathParts.length === 0) {
    return { target: service, path: [] };
  }

  let current: unknown = service;
  for (let i = 0; i < pathParts.length - 1; i++) {
    // Unwrap signals at each segment so model.item.a works even when
    // model or item are signals.
    if (current != null && isSignal(current)) {
      current = (current as Signal<unknown>)();
    }
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[pathParts[i]];
  }
  // Do not unwrap the final segment here; leave it to getRefValue / setRefValue so they
  // can consistently handle signals and functions at the leaf.
  return { target: current, path: pathParts.slice(-1) };
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
  const val =
    resolved.path.length === 0
      ? resolved.target
      : (resolved.target as Record<string, unknown>)?.[resolved.path[0]];
  if (val != null && isSignal(val)) {
    return val as Signal<unknown>;
  }
  return undefined;
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
