import { computed, type Signal } from '@angular/core';
import type { BlockRegistry } from './block-registry';
import { parseRefPath } from './ref-expressions';

export interface ResolverContext {
  registry: BlockRegistry;
  /** Current block's full id (nearest block with id). */
  currentBlockId?: string;
  /** Current block's instance (services/state by name). */
  currentInstance?: Record<string, unknown>;
}

/**
 * Resolve a ref path to the target object and path.
 * Path format: "instance.FormState.firstName" (context) or "UserForm.instance.FormState.firstName" (registry).
 */
export function resolveRefPath(
  refPath: string,
  ctx: ResolverContext
): { target: unknown; path: string[] } | null {
  const { blockId, pathParts } = parseRefPath(refPath);
  if (pathParts[0] !== 'instance' || pathParts.length < 2) {
    return null;
  }
  const rest = pathParts.slice(2);
  const serviceOrProp = pathParts[1];

  let instance: Record<string, unknown> | undefined;
  if (blockId != null) {
    // Prefer current block's instance when ref points to this block (e.g. root resolving nested refs to itself)
    if (blockId === ctx.currentBlockId && ctx.currentInstance != null) {
      instance = ctx.currentInstance;
    } else {
      const handle = ctx.registry.get(blockId);
      instance = handle?.instance as Record<string, unknown> | undefined;
    }
  } else if (ctx.currentInstance != null) {
    instance = ctx.currentInstance;
  }
  if (instance == null) return null;

  const service = instance[serviceOrProp];
  if (rest.length === 0) {
    return { target: service, path: [] };
  }
  let current: unknown = service;
  for (let i = 0; i < rest.length - 1; i++) {
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[rest[i]];
  }
  return { target: current, path: rest.slice(-1) };
}

/**
 * Get value at ref path (read-only). Returns undefined if not found.
 */
export function getRefValue(refPath: string, ctx: ResolverContext): unknown {
  const resolved = resolveRefPath(refPath, ctx);
  if (resolved == null || resolved.path.length === 0) {
    return resolved?.target;
  }
  const obj = resolved.target as Record<string, unknown>;
  const key = resolved.path[0];
  const val = obj?.[key];
  // Unwrap Angular signals and other getter functions by calling them
  if (typeof val === 'function') {
    return (val as () => unknown)();
  }
  return val;
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
  // Angular signals are callable (typeof 'function') but have .set; treat any value with .set as writable so we don't overwrite the signal with a string
  const writable =
    val != null &&
    typeof (val as Record<string, unknown>)['set'] === 'function'
      ? (val as { set: (v: unknown) => void })
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
  ctx: ResolverContext
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
