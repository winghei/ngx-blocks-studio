import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import {
  createInputBindingsWithWarnings,
  linkedTwoWayFromInputGetter,
} from '../../projects/blocks-studio/src/lib/core/block-loader/block-loader.service';
import { BlockLoaderService } from '../../projects/blocks-studio/src/lib/core/block-loader/block-loader.service';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';
import { resolveBlockInputsAndOutputs } from '../../projects/blocks-studio/src/lib/core/block-loader/block-bindings';
import { TestBed } from '@angular/core/testing';

describe('createInputBindingsWithWarnings', () => {
  it('uses linkedSignal fallback when two-way has input getter only', () => {
    const s = signal('v');
    const bindings = createInputBindingsWithWarnings(
      'host',
      new Set(),
      new Set(['field']),
      new Set(),
      { field: () => s() },
      {},
      {},
    );
    expect(bindings).toHaveLength(1);
  });

  it('uses linkedSignal fallback for two-way keys with mustache-only inputs', () => {
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: { model: signal({ x: 1 }), services: {} },
    };
    const twoWayKeys = new Set(['caption']);
    const { resolvedInputs, resolvedTwoWay } = resolveBlockInputsAndOutputs(
      { inputs: { caption: '{{ model.x }}' } },
      new Set(),
      new Set(),
      twoWayKeys,
      ctx,
    );
    expect(resolvedInputs.caption).toBeDefined();
    expect(resolvedTwoWay.caption).toBeUndefined();
    const bindings = createInputBindingsWithWarnings(
      'host',
      new Set(),
      twoWayKeys,
      new Set(),
      resolvedInputs,
      resolvedTwoWay,
      {},
    );
    expect(bindings).toHaveLength(1);
    const tw = linkedTwoWayFromInputGetter({ caption: () => 1 }, 'caption');
    expect(tw()).toBe(1);
  });
});

describe('BlockLoaderService.resolveContextModel', () => {
  it('covers string ref fallback and object mustache model', async () => {
    await TestBed.configureTestingModule({ providers: [BlockLoaderService] }).compileComponents();
    const loader = TestBed.inject(BlockLoaderService);
    const registry = new BlockRegistryImpl();
    const blockInstance = { services: {} as Record<string, unknown> };
    const ctx = { registry, currentInstance: blockInstance };

    const resolve = (
      loader as unknown as {
        resolveContextModel: (c: typeof ctx, m: ReturnType<typeof signal>) => void;
      }
    ).resolveContextModel.bind(loader);

    resolve(ctx, signal('NoSuchService.field'));
    expect(() => blockInstance.model!()).not.toThrow();

    const block2 = { services: {} as Record<string, unknown> };
    resolve(
      { registry, currentInstance: block2 },
      signal({ title: '{{ model.name }}', name: 'n' }),
    );
    expect(() => block2.model!()).not.toThrow();

    const block3 = { services: {} as Record<string, unknown> };
    resolve({ registry, currentInstance: block3 }, signal('{{ model.count }}'));
    expect(() => block3.model!()).not.toThrow();
  });
});
