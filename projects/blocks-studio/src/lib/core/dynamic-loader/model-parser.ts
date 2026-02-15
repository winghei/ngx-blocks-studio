import { signal, computed, effect, type Signal } from '@angular/core';
import type { BlockInstanceHandle } from './dynamic-block-registry';
import {
  isWritableRefString,
  containsWritableRef,
  extractReadonlyRefs,
  parseRef,
} from './model-expressions';
import {
  resolveRef,
  getWritableAtPath,
  writeBackAtPath,
} from './model-resolver';

export interface BuildBlockDataOptions {
  getBlock: (id: string) => BlockInstanceHandle | undefined;
}

export interface BuildBlockDataResult {
  blockData: Signal<unknown> | Record<string, Signal<unknown> | unknown>;
  blockEffectCleanups: Array<() => void>;
}

function isPlainPrimitive(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isAllowedModelValue(value: unknown): boolean {
  if (value === null || isPlainPrimitive(value)) return true;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.values(value as object).every(isAllowedModelValue);
  }
  return false;
}

/**
 * Reject object model if any nested string value contains a writable ref but is not exactly a writable ref (case 5).
 */
function rejectWritableRefInObject(model: Record<string, unknown>): void {
  for (const v of Object.values(model)) {
    if (typeof v === 'string' && containsWritableRef(v) && !isWritableRefString(v)) {
      throw new Error(
        'Model invalid: writable ref [(...)] is not allowed inside object string values. Use [(...)] only as a full field value.'
      );
    }
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      rejectWritableRefInObject(v as Record<string, unknown>);
    }
  }
}

/**
 * Build blockData and collect effect cleanups from model.
 * Must be run in an injection context (e.g. componentRef.injector.runInContext) so effect() is tied to the component.
 */
export function buildBlockData(
  model: unknown,
  options: BuildBlockDataOptions
): BuildBlockDataResult {
  const { getBlock } = options;
  const blockEffectCleanups: Array<() => void> = [];

  if (model === undefined) {
    return { blockData: signal(undefined), blockEffectCleanups };
  }

  if (!isAllowedModelValue(model)) {
    throw new Error('Model may only contain number, string, boolean, or nested objects with those values.');
  }

  if (typeof model === 'object' && model !== null && !Array.isArray(model)) {
    rejectWritableRefInObject(model as Record<string, unknown>);
  }

  if (isPlainPrimitive(model) && typeof model !== 'string') {
    return { blockData: signal(model), blockEffectCleanups };
  }

  if (typeof model === 'string') {
    if (isWritableRefString(model)) {
      const match = model.trim().match(/^\[\(([^)]+)\)\]$/);
      const refPath = match ? match[1].trim() : '';
      const { refId, path } = parseRef(refPath);
      const block = getBlock(refId);
      if (!block) {
        return { blockData: signal(undefined), blockEffectCleanups };
      }
      const writable = getWritableAtPath(block, path);
      if (writable) {
        return { blockData: writable, blockEffectCleanups };
      }
      const readOnly = computed(() => resolveRef(refPath, getBlock));
      const localSignal = signal(resolveRef(refPath, getBlock));
      const eff = effect(() => {
        writeBackAtPath(block, path, localSignal());
      });
      blockEffectCleanups.push(eff.destroy.bind(eff));
      return { blockData: localSignal, blockEffectCleanups };
    }

    const readonlyRefs = extractReadonlyRefs(model);
    if (readonlyRefs.length === 0) {
      return { blockData: signal(model), blockEffectCleanups };
    }
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const computedVal = computed(() => {
      let out = model as string;
      for (const refPath of readonlyRefs) {
        const val = resolveRef(refPath, getBlock);
        const str = val != null ? String(val) : '';
        out = out.replace(new RegExp(`\\{\\{${escapeRe(refPath)}\\}\\}`, 'g'), str);
      }
      return out;
    });
    return { blockData: computedVal, blockEffectCleanups };
  }

  if (typeof model === 'object' && model !== null && !Array.isArray(model)) {
    const obj = model as Record<string, unknown>;
    const result: Record<string, Signal<unknown> | unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && isWritableRefString(value)) {
        const match = value.trim().match(/^\[\(([^)]+)\)\]$/);
        const refPath = match ? match[1].trim() : '';
        const { refId, path } = parseRef(refPath);
        const block = getBlock(refId);
        if (!block) {
          result[key] = signal(undefined);
          continue;
        }
        const writable = getWritableAtPath(block, path);
        if (writable) {
          result[key] = writable;
        } else {
          const localSignal = signal(resolveRef(refPath, getBlock));
          const eff = effect(() => {
            writeBackAtPath(block, path, localSignal());
          });
          blockEffectCleanups.push(eff.destroy.bind(eff));
          result[key] = localSignal;
        }
      } else if (typeof value === 'string' && extractReadonlyRefs(value).length > 0) {
        const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result[key] = computed(() => {
          let out = value;
          for (const refPath of extractReadonlyRefs(value)) {
            const val = resolveRef(refPath, getBlock);
            const str = val != null ? String(val) : '';
            out = out.replace(new RegExp(`\\{\\{${escapeRe(refPath)}\\}\\}`, 'g'), str);
          }
          return out;
        });
      } else if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        const nested = buildBlockData(value, options);
        result[key] = nested.blockData as Signal<unknown>;
        blockEffectCleanups.push(...nested.blockEffectCleanups);
      } else {
        result[key] = signal(value);
      }
    }
    return { blockData: result, blockEffectCleanups };
  }

  return { blockData: signal(model), blockEffectCleanups };
}
