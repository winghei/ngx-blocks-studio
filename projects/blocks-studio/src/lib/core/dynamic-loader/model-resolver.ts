import type { Signal } from '@angular/core';
import type { BlockInstanceHandle } from './dynamic-block-registry';
import { parseRef } from './model-expressions';

function isSignal(x: unknown): x is Signal<unknown> {
  return typeof x === 'function' && x !== null && 'set' in (x as object);
}

/**
 * Get the current value at blockData path; if any step is a signal, call it.
 */
export function resolvePath(
  handle: BlockInstanceHandle,
  path: string[]
): unknown {
  let current: unknown =
    typeof handle.blockData === 'function'
      ? (handle.blockData as Signal<unknown>)()
      : handle.blockData;

  for (const key of path) {
    if (current == null) return undefined;
    if (typeof current !== 'object') return undefined;
    const next = (current as Record<string, unknown>)[key];
    current = isSignal(next) ? (next as Signal<unknown>)() : next;
  }
  return current;
}

/**
 * Resolve a ref string "RefId.path.to.prop" using getBlock.
 */
export function resolveRef(
  refPath: string,
  getBlock: (id: string) => BlockInstanceHandle | undefined
): unknown {
  const { refId, path } = parseRef(refPath);
  const block = getBlock(refId);
  if (!block) return undefined;
  return resolvePath(block, path);
}

/**
 * Check if the value at path is a writable signal (has .set).
 */
export function isWritableSignalAtPath(
  handle: BlockInstanceHandle,
  path: string[]
): boolean {
  if (path.length === 0) {
    const bd = handle.blockData;
    return isSignal(bd) && 'set' in (bd as object);
  }
  let current: unknown =
    typeof handle.blockData === 'function'
      ? (handle.blockData as Signal<unknown>)()
      : handle.blockData;
  for (let i = 0; i < path.length - 1; i++) {
    if (current == null || typeof current !== 'object') return false;
    const next = (current as Record<string, unknown>)[path[i]];
    current = isSignal(next) ? (next as Signal<unknown>)() : next;
  }
  const key = path[path.length - 1];
  if (current == null || typeof current !== 'object') return false;
  const leaf = (current as Record<string, unknown>)[key];
  return isSignal(leaf) && 'set' in (leaf as object);
}

/**
 * Get the signal or value at path for writing (two-way). Returns undefined if not writable.
 */
export function getWritableAtPath(
  handle: BlockInstanceHandle,
  path: string[]
): Signal<unknown> | undefined {
  if (path.length === 0) {
    const bd = handle.blockData;
    if (isSignal(bd) && 'set' in (bd as object)) return bd as Signal<unknown>;
    return undefined;
  }
  let current: unknown =
    typeof handle.blockData === 'function'
      ? (handle.blockData as Signal<unknown>)()
      : handle.blockData;
  for (let i = 0; i < path.length - 1; i++) {
    if (current == null || typeof current !== 'object') return undefined;
    const next = (current as Record<string, unknown>)[path[i]];
    current = isSignal(next) ? (next as Signal<unknown>)() : next;
  }
  const key = path[path.length - 1];
  if (current == null || typeof current !== 'object') return undefined;
  const leaf = (current as Record<string, unknown>)[key];
  if (isSignal(leaf) && 'set' in (leaf as object))
    return leaf as Signal<unknown>;
  return undefined;
}

/**
 * Write value at path. If leaf is a writable signal, call .set(value). Otherwise update root signal's object immutably.
 */
export function writeBackAtPath(
  handle: BlockInstanceHandle,
  path: string[],
  value: unknown
): void {
  const bd = handle.blockData;
  if (path.length === 0) {
    if (isSignal(bd) && 'set' in (bd as object)) {
      (bd as unknown as { set: (v: unknown) => void }).set(value);
    }
    return;
  }
  const leafSignal = getWritableAtPath(handle, path);
  if (leafSignal) {
    (leafSignal as unknown as { set: (v: unknown) => void }).set(value);
    return;
  }
  if (!isSignal(bd) || typeof (bd as Signal<unknown>)() !== 'object') return;
  const root = (bd as Signal<unknown>)() as Record<string, unknown>;
  const newRoot = setAtPath(root, path, value);
  (bd as unknown as { set: (v: unknown) => void }).set(newRoot);
}

function setAtPath(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown
): Record<string, unknown> {
  if (path.length === 0) return obj;
  const [key, ...rest] = path;
  if (rest.length === 0) {
    return { ...obj, [key]: value };
  }
  const child = obj[key];
  const childObj =
    child != null && typeof child === 'object' && !isSignal(child)
      ? (child as Record<string, unknown>)
      : {};
  return { ...obj, [key]: setAtPath(childObj, rest, value) };
}
