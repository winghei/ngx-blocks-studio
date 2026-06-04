import { describe, it, expect, beforeEach } from 'vitest';
import {
  safeParseBlockDescription,
  normalizeServices,
  normalizeDirectives,
  isBlockReference,
  deepMergeBlockDefinition,
  resolveBlockReference,
  isOutputReference,
  type BlockReference,
} from '../../projects/blocks-studio/src/lib/core/block-loader/block-description.schema';
import { BlockDefinitionsRegistry } from '../../projects/blocks-studio/src/lib/core/registry/block-definitions.registry';

describe('block-description.schema', () => {
  describe('safeParseBlockDescription (re-export)', () => {
    it('matches validate module behavior', () => {
      const ok = safeParseBlockDescription({ component: 'X' });
      const bad = safeParseBlockDescription({ component: '' });
      expect(ok.success).toBe(true);
      expect(bad.success).toBe(false);
    });
  });

  describe('normalizeServices', () => {
    it('returns empty array for null or undefined', () => {
      expect(normalizeServices(undefined as never)).toEqual([]);
      expect(normalizeServices(null as never)).toEqual([]);
    });

    it('returns array for single string', () => {
      expect(normalizeServices('FormState' as never)).toEqual(['FormState']);
    });

    it('returns array for single object entry', () => {
      expect(normalizeServices({ id: 'FormState', scope: 'self' } as never)).toEqual([
        { id: 'FormState', scope: 'self' },
      ]);
    });

    it('returns same array for array input', () => {
      const arr = ['A', { id: 'B', scope: 'self' as const }];
      expect(normalizeServices(arr)).toEqual(arr);
    });
  });

  describe('normalizeDirectives', () => {
    it('returns empty array for null or undefined', () => {
      expect(normalizeDirectives(undefined as never)).toEqual([]);
      expect(normalizeDirectives(null as never)).toEqual([]);
    });

    it('returns array for single string', () => {
      expect(normalizeDirectives('Tooltip')).toEqual(['Tooltip']);
    });

    it('returns same array for array input', () => {
      expect(normalizeDirectives(['A', 'B'])).toEqual(['A', 'B']);
    });
  });

  describe('isBlockReference', () => {
    it('returns true for object with blockId only', () => {
      expect(isBlockReference({ blockId: 'X' })).toBe(true);
    });

    it('returns true for object with id only', () => {
      expect(isBlockReference({ id: 'X' })).toBe(true);
    });

    it('returns true for object with blockId and blockDefinition', () => {
      expect(isBlockReference({ blockId: 'X', blockDefinition: { inputs: {} } })).toBe(true);
    });

    it('returns false for null or non-object', () => {
      expect(isBlockReference(null)).toBe(false);
      expect(isBlockReference(undefined)).toBe(false);
      expect(isBlockReference('string')).toBe(false);
    });

    it('returns false for object with component (full description)', () => {
      expect(isBlockReference({ component: 'C', id: 'X' })).toBe(false);
    });

    it('returns false for empty id/blockId', () => {
      expect(isBlockReference({ blockId: '' })).toBe(false);
      expect(isBlockReference({ id: '' })).toBe(false);
    });
  });

  describe('isOutputReference', () => {
    it('returns true for valid output reference', () => {
      expect(isOutputReference({ ref: 'Block:SomeService.path.set' })).toBe(true);
    });

    it('returns false for plain object', () => {
      expect(isOutputReference({ reference: 'X', method: 'set' })).toBe(false);
    });

    it('returns false for null or non-object', () => {
      expect(isOutputReference(null)).toBe(false);
      expect(isOutputReference('string')).toBe(false);
    });
  });

  describe('deepMergeBlockDefinition', () => {
    it('merges override keys into base', () => {
      const base = { a: 1, b: { x: 10 }, c: [1] };
      const override = { b: { y: 20 }, d: 2 };
      const result = deepMergeBlockDefinition(base, override);
      expect(result).toEqual({ a: 1, b: { x: 10, y: 20 }, c: [1], d: 2 });
    });

    it('replaces arrays and primitives', () => {
      const base = { arr: [1, 2], num: 5 };
      const override = { arr: [3], num: 10 };
      const result = deepMergeBlockDefinition(base, override);
      expect(result['arr']).toEqual([3]);
      expect(result['num']).toBe(10);
    });

    it('does not mutate base', () => {
      const base = { a: 1 };
      const override = { b: 2 };
      deepMergeBlockDefinition(base, override);
      expect(base).toEqual({ a: 1 });
    });
  });

  describe('resolveBlockReference', () => {
    const registry = BlockDefinitionsRegistry.getInstance();

    beforeEach(() => {
      registry.register('TestBlock', {
        component: 'TestComponent',
        id: 'TestBlock',
        inputs: { initial: true },
        services: [],
      });
    });

    it('resolves from blockDefinitions when provided', async () => {
      const defs = {
        TestBlock: {
          component: 'OverrideComponent',
          id: 'TestBlock',
          inputs: { initial: false },
        },
      };
      const result = await resolveBlockReference(
        { blockId: 'TestBlock' } as BlockReference,
        defs,
      );
      expect(result['component']).toBe('OverrideComponent');
      expect((result as { inputs?: { initial?: boolean } }).inputs?.['initial']).toBe(false);
    });

    it('resolves from global registry when not in blockDefinitions', async () => {
      const result = await resolveBlockReference(
        { blockId: 'TestBlock' } as BlockReference,
        {},
      );
      expect(result['component']).toBe('TestComponent');
      expect((result as { inputs?: { initial?: boolean } }).inputs?.['initial']).toBe(true);
    });

    it('merges blockDefinition override onto base', async () => {
      const result = await resolveBlockReference(
        {
          blockId: 'TestBlock',
          blockDefinition: { inputs: { extra: 'value' } },
        } as BlockReference,
        {},
      );
      expect((result as { inputs?: Record<string, unknown> }).inputs?.['initial']).toBe(true);
      expect((result as { inputs?: Record<string, unknown> }).inputs?.['extra']).toBe('value');
    });

    it('resolves lazy blockDefinitions entry (loader)', async () => {
      const defs = {
        LazyBlock: () =>
          Promise.resolve({
            component: 'LazyComponent',
            id: 'LazyBlock',
            inputs: { from: 'loader' },
          }),
      };
      const result = await resolveBlockReference(
        { blockId: 'LazyBlock' } as BlockReference,
        defs,
      );
      expect(result['component']).toBe('LazyComponent');
      expect((result as { inputs?: { from?: string } }).inputs?.['from']).toBe('loader');
    });

    it('resolves from global registry when registered as loader', async () => {
      registry.register('LazyGlobalBlock', () =>
        Promise.resolve({
          component: 'LazyG',
          id: 'LazyGlobalBlock',
          inputs: {},
          services: [],
        }),
      );
      try {
        const result = await resolveBlockReference(
          { blockId: 'LazyGlobalBlock' } as BlockReference,
          {},
        );
        expect(result['component']).toBe('LazyG');
      } finally {
        registry.unregister('LazyGlobalBlock');
      }
    });

    it('throws when blockId is missing', async () => {
      await expect(
        resolveBlockReference({ id: 'X' } as BlockReference, {}),
      ).rejects.toThrow('Block reference must have blockId');
    });

    it('throws when block is not found', async () => {
      await expect(
        resolveBlockReference({ blockId: 'NonExistent' } as BlockReference, {}),
      ).rejects.toThrow('Block "NonExistent" has no definition');
    });
  });
});
