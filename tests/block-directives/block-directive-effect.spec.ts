import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComponentRef, ViewContainerRef } from '@angular/core';
import {
  clearBlockDirective,
  createInitialBlockDirectiveLoadState,
  runBlockDirectiveEffect,
  type BlockDirectiveLoadState,
} from '../../projects/blocks-studio/src/lib/core/block-loader/block-directive-effect';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';

function mockViewContainerRef(): ViewContainerRef {
  return { clear: vi.fn() } as unknown as ViewContainerRef;
}

function mockComponentRef(): ComponentRef<unknown> {
  return { destroy: vi.fn() } as unknown as ComponentRef<unknown>;
}

describe('runBlockDirectiveEffect', () => {
  let state: BlockDirectiveLoadState;
  let vcr: ViewContainerRef;
  let loadBlock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = createInitialBlockDirectiveLoadState();
    vcr = mockViewContainerRef();
    loadBlock = vi.fn().mockResolvedValue(mockComponentRef());
  });

  it('clears when description is null', () => {
    state.loadResult = mockComponentRef();
    state.lastId = 'id-1';
    state.lastRegistry = new BlockRegistryImpl();
    state.lastRegistry.register('id-1', { instance: { services: {} } });

    runBlockDirectiveEffect(state, { viewContainerRef: vcr, loadBlock }, null, null, null, null);

    expect(vcr.clear).toHaveBeenCalled();
    expect(state.lastRegistry.hasLocal('id-1')).toBe(false);
    expect(loadBlock).not.toHaveBeenCalled();
  });

  it('loads a full description and records loaded metadata', async () => {
    runBlockDirectiveEffect(
      state,
      { viewContainerRef: vcr, loadBlock },
      { component: 'MyBlock' },
      null,
      null,
      null,
    );
    await vi.waitFor(() => expect(loadBlock).toHaveBeenCalledTimes(1));
    expect(state.loadedComponent).toBe('MyBlock');
    expect(state.loadResult).toBeTruthy();
  });

  it('skips reload when only the description object reference changes', async () => {
    const description = { component: 'MyBlock', inputs: { a: 1 } };
    runBlockDirectiveEffect(state, { viewContainerRef: vcr, loadBlock }, description, null, null, null);
    await vi.waitFor(() => expect(loadBlock).toHaveBeenCalledTimes(1));

    runBlockDirectiveEffect(
      state,
      { viewContainerRef: vcr, loadBlock },
      { ...description },
      null,
      null,
      null,
    );
    await Promise.resolve();
    expect(loadBlock).toHaveBeenCalledTimes(1);
  });

  it('reloads when reloadKey changes', async () => {
    const description = { component: 'MyBlock' };
    runBlockDirectiveEffect(state, { viewContainerRef: vcr, loadBlock }, description, null, null, 0);
    await vi.waitFor(() => expect(loadBlock).toHaveBeenCalledTimes(1));

    runBlockDirectiveEffect(state, { viewContainerRef: vcr, loadBlock }, description, null, null, 1);
    await vi.waitFor(() => expect(loadBlock).toHaveBeenCalledTimes(2));
  });

  it('resolves block references via blockDefinitions', async () => {
    runBlockDirectiveEffect(
      state,
      { viewContainerRef: vcr, loadBlock },
      { blockId: 'Ref' },
      { Ref: { component: 'FromDef' } },
      null,
      null,
    );
    await vi.waitFor(() => expect(loadBlock).toHaveBeenCalledTimes(1));
    expect(loadBlock.mock.calls[0][0]).toMatchObject({ component: 'FromDef' });
  });

  it('logs when block reference resolution fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    runBlockDirectiveEffect(
      state,
      { viewContainerRef: vcr, loadBlock },
      { blockId: 'Missing' },
      null,
      null,
      null,
    );
    await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    expect(consoleSpy.mock.calls[0][0]).toBe('Block reference resolution failed:');
    consoleSpy.mockRestore();
  });

  it('logs when load fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    loadBlock.mockRejectedValueOnce(new Error('load failed'));
    runBlockDirectiveEffect(
      state,
      { viewContainerRef: vcr, loadBlock },
      { component: 'MyBlock' },
      null,
      null,
      null,
    );
    await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('Block load failed:', expect.any(Error)));
    consoleSpy.mockRestore();
  });

  it('ignores runAfterResolved when effect run id is stale', async () => {
    let resolveSlow!: (v: Record<string, unknown>) => void;
    const slowDefs = {
      Slow: () =>
        new Promise<Record<string, unknown>>((resolve) => {
          resolveSlow = resolve;
        }),
    };
    runBlockDirectiveEffect(
      state,
      { viewContainerRef: vcr, loadBlock },
      { blockId: 'Slow' },
      slowDefs,
      null,
      null,
    );
    runBlockDirectiveEffect(
      state,
      { viewContainerRef: vcr, loadBlock },
      { component: 'After' },
      null,
      null,
      null,
    );
    resolveSlow({ component: 'SlowBlock' });
    await Promise.resolve();
    expect(loadBlock).not.toHaveBeenCalledWith(
      expect.objectContaining({ component: 'SlowBlock' }),
      undefined,
      undefined,
    );
  });

  it('skips load when resolved description fails validation', async () => {
    runBlockDirectiveEffect(
      state,
      { viewContainerRef: vcr, loadBlock },
      { blockId: 'Bad' },
      { Bad: { notAComponent: true } },
      null,
      null,
    );
    await Promise.resolve();
    expect(loadBlock).not.toHaveBeenCalled();
  });

  it('reuses cached parse for same description reference', async () => {
    const description = { component: 'MyBlock', services: ['S'] };
    state.lastDescRef = description;
    state.lastParsedData = { component: 'MyBlock', services: ['S'], directives: [] };
    runBlockDirectiveEffect(state, { viewContainerRef: vcr, loadBlock }, description, null, null, null);
    await vi.waitFor(() => expect(loadBlock).toHaveBeenCalledTimes(1));
  });

  it('ignores stale async results when effect re-runs', async () => {
    let resolveLoad!: (ref: ComponentRef<unknown>) => void;
    loadBlock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    );

    runBlockDirectiveEffect(
      state,
      { viewContainerRef: vcr, loadBlock },
      { component: 'First' },
      null,
      null,
      null,
    );
    runBlockDirectiveEffect(state, { viewContainerRef: vcr, loadBlock }, { component: 'Second' }, null, null, null);
    resolveLoad(mockComponentRef());
    await Promise.resolve();
    expect(state.loadedComponent).not.toBe('First');
  });
});

describe('clearBlockDirective', () => {
  it('unregisters last id and clears the view container', () => {
    const state = createInitialBlockDirectiveLoadState();
    const vcr = mockViewContainerRef();
    const registry = new BlockRegistryImpl();
    registry.register('x', { instance: { services: {} } });
    state.loadResult = mockComponentRef();
    state.lastId = 'x';
    state.lastRegistry = registry;

    clearBlockDirective(state, vcr);

    expect(registry.hasLocal('x')).toBe(false);
    expect(vcr.clear).toHaveBeenCalled();
    expect(state.loadResult).toBeNull();
  });
});
