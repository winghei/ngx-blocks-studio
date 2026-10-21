import { classifyTwoWayString, parseTwoWayRef } from './ref-expressions';
import type { ResolverContext } from './ref-resolver';
import { getRefValue } from './ref-resolver';
import { looksLikeFlowTemplate, resolveTemplateString } from './template-interpolation';

/** JSON-like objects only — skip class instances, Date, Map, etc. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function stringNeedsInputResolve(s: string): boolean {
  if (classifyTwoWayString(s) !== 'none') return true;
  if (s.includes('{{') && s.includes('}}')) return true;
  if (looksLikeFlowTemplate(s)) return true;
  return false;
}

/** True when any string leaf in the tree needs input-style resolution (mustache, flow, or `[( )]`). */
export function valueNeedsInputResolve(
  value: unknown,
  visited: WeakSet<object> = new WeakSet(),
): boolean {
  if (typeof value === 'string') {
    return stringNeedsInputResolve(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => valueNeedsInputResolve(item, visited));
  }
  if (value != null && typeof value === 'object') {
    if (!isPlainObject(value)) return false;
    if (visited.has(value)) return false;
    visited.add(value);
    return Object.values(value).some((item) => valueNeedsInputResolve(item, visited));
  }
  return false;
}

/** True when any string leaf contains `{{ }}` (block model seeding). */
export function valueContainsMustacheInTree(
  value: unknown,
  visited: WeakSet<object> = new WeakSet(),
): boolean {
  if (typeof value === 'string') {
    return value.includes('{{') && value.includes('}}');
  }
  if (Array.isArray(value)) {
    return value.some((item) => valueContainsMustacheInTree(item, visited));
  }
  if (value != null && typeof value === 'object') {
    if (!isPlainObject(value)) return false;
    if (visited.has(value)) return false;
    visited.add(value);
    return Object.values(value).some((item) => valueContainsMustacheInTree(item, visited));
  }
  return false;
}

export interface ResolveNestedTemplateOptions {
  /**
   * When true, exact `[(refPath)]` strings resolve to the current ref value (read-only).
   * Does not create Angular two-way bindings on nested keys.
   */
  resolveTwoWayStringsAsReadonly?: boolean;
  escapeFlowRefs?: boolean;
}

function resolveStringLeaf(
  str: string,
  ctx: ResolverContext,
  path: string,
  options: ResolveNestedTemplateOptions,
): unknown {
  const twoWayKind = classifyTwoWayString(str);
  if (twoWayKind === 'invalid-mix') {
    throw new Error(
      `Invalid value at "${path}": two-way ref "[( )]" cannot be mixed with literals or "{{ }}". ` +
        `Use exactly "[(refPath)]" for read-resolve or "{{ refPath }}" for read-only.`,
    );
  }
  if (twoWayKind === 'two-way' && options.resolveTwoWayStringsAsReadonly) {
    const refPath = parseTwoWayRef(str);
    if (refPath) {
      return getRefValue(refPath, ctx);
    }
  }
  return resolveTemplateString(str, ctx, undefined, {
    escapeFlowRefs: options.escapeFlowRefs !== false,
  });
}

/**
 * Deep-resolve template strings in plain objects and arrays (new object graph each call).
 */
export function resolveNestedTemplateValues(
  value: unknown,
  ctx: ResolverContext,
  path = '',
  visited: WeakSet<object> = new WeakSet(),
  options: ResolveNestedTemplateOptions = {},
): unknown {
  if (typeof value === 'string') {
    return resolveStringLeaf(value, ctx, path || 'input', options);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const childPath = path ? `${path}[${index}]` : `[${index}]`;
      return resolveNestedTemplateValues(item, ctx, childPath, visited, options);
    });
  }
  if (value != null && typeof value === 'object') {
    if (!isPlainObject(value)) return value;
    if (visited.has(value)) return value;
    visited.add(value);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        const childPath = path ? `${path}.${key}` : key;
        return [key, resolveNestedTemplateValues(item, ctx, childPath, visited, options)];
      }),
    );
  }
  return value;
}
