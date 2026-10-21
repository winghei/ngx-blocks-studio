import type { ComponentRef, ViewContainerRef } from '@angular/core';
import type { BlockRegistry } from './block-registry';
import type { BlockDefinitionOrLoader } from '../registry/block-definitions.registry';
import type { BlockDescription, BlockInput } from './block-description.schema';
import {
  safeParseBlockDescription,
  isBlockReference,
  resolveBlockReference,
  type BlockReference,
} from './block-description.schema';
import { getServicesKey, safeJsonKey } from './block-directive-keys';

export interface BlockDirectiveLoadState {
  loadResult: ComponentRef<unknown> | null;
  lastRegistry: BlockRegistry | null;
  lastId: string | null;
  loadedComponent: string | null;
  loadedServicesKey: string | null;
  loadedReloadKey: unknown;
  loadedDescKey: string | null;
  loadGeneration: number;
  effectRunId: number;
  lastDescRef: unknown;
  lastParsedData: BlockDescription | null;
}

export interface BlockDirectiveEffectContext {
  viewContainerRef: ViewContainerRef;
  loadBlock: (
    resolved: BlockInput | BlockReference,
    registry?: BlockRegistry,
    blockDefinitions?: Record<string, BlockDefinitionOrLoader>,
  ) => Promise<ComponentRef<unknown>>;
}

export function createInitialBlockDirectiveLoadState(): BlockDirectiveLoadState {
  return {
    loadResult: null,
    lastRegistry: null,
    lastId: null,
    loadedComponent: null,
    loadedServicesKey: null,
    loadedReloadKey: null,
    loadedDescKey: null,
    loadGeneration: 0,
    effectRunId: 0,
    lastDescRef: null,
    lastParsedData: null,
  };
}

export function clearBlockDirective(
  state: BlockDirectiveLoadState,
  viewContainerRef: ViewContainerRef,
): void {
  state.loadGeneration++;
  state.lastDescRef = null;
  state.lastParsedData = null;
  if (state.lastId != null) {
    state.lastRegistry?.unregister(state.lastId);
    state.lastId = null;
  }
  if (state.loadResult) {
    viewContainerRef.clear();
    state.loadResult = null;
    state.loadedComponent = null;
    state.loadedServicesKey = null;
    state.loadedReloadKey = null;
    state.loadedDescKey = null;
  }
}

export function runBlockDirectiveEffect(
  state: BlockDirectiveLoadState,
  ctx: BlockDirectiveEffectContext,
  desc: BlockInput | BlockReference | null,
  inputDefs: Record<string, BlockDefinitionOrLoader> | null,
  blockRegistry: BlockRegistry | null,
  reloadKey: unknown,
): void {
  const runId = ++state.effectRunId;

  if (desc == null) {
    state.lastDescRef = null;
    state.lastParsedData = null;
    clearBlockDirective(state, ctx.viewContainerRef);
    return;
  }

  const runAfterResolved = (resolved: Record<string, unknown>) => {
    if (runId !== state.effectRunId) {
      return;
    }

    let data: BlockDescription;
    if (resolved === state.lastDescRef && state.lastParsedData != null) {
      data = state.lastParsedData;
    } else {
      const parsed = safeParseBlockDescription(resolved);
      if (!parsed.success) {
        return;
      }
      state.lastDescRef = resolved;
      state.lastParsedData = parsed.data;
      data = parsed.data;
    }
    const servicesKey = getServicesKey(data.services);
    const descKey = safeJsonKey(resolved);
    const effectiveReloadKey = reloadKey ?? descKey;

    const mustReload =
      state.loadResult == null ||
      state.loadedComponent !== data.component ||
      state.loadedServicesKey !== servicesKey ||
      state.loadedReloadKey !== effectiveReloadKey ||
      state.loadedDescKey !== descKey;
    if (!mustReload) {
      return;
    }

    clearBlockDirective(state, ctx.viewContainerRef);
    const registry = blockRegistry ?? undefined;
    state.lastRegistry = registry ?? null;
    state.lastId = data.id ?? null;

    const generation = ++state.loadGeneration;
    ctx
      .loadBlock(resolved, registry, inputDefs ?? undefined)
      .then((result) => {
        if (generation !== state.loadGeneration) return;
        state.loadResult = result;
        state.loadedComponent = data.component;
        state.loadedServicesKey = servicesKey;
        state.loadedReloadKey = effectiveReloadKey;
        state.loadedDescKey = descKey;
      })
      .catch((err: unknown) => {
        if (generation !== state.loadGeneration) return;
        console.error('Block load failed:', err);
      });
  };

  if (isBlockReference(desc)) {
    void resolveBlockReference(desc, inputDefs ?? undefined)
      .then((resolved) => {
        runAfterResolved(resolved);
      })
      .catch((err: unknown) => {
        if (runId !== state.effectRunId) return;
        console.error('Block reference resolution failed:', err);
      });
    return;
  }

  runAfterResolved(desc as unknown as Record<string, unknown>);
}
