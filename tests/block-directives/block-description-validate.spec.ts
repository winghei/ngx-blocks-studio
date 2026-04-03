import { describe, it, expect } from 'vitest';
import { safeParseBlockDescription } from '../../projects/blocks-studio/src/lib/core/block-loader/block-description-validate';

describe('safeParseBlockDescription', () => {
  it('parses a minimal valid description (component only)', () => {
    const result = safeParseBlockDescription({ component: 'MyComponent' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.component).toBe('MyComponent');
      expect(result.data.id).toBeUndefined();
      expect(result.data.services).toEqual([]);
      expect(result.data.directives).toEqual([]);
      expect(result.data.inputs).toBeUndefined();
      expect(result.data.outputs).toBeUndefined();
    }
  });

  it('parses full description with all optional fields', () => {
    const desc = {
      component: 'Layout',
      id: 'MyBlock',
      services: [{ id: 'FormState', scope: 'self' as const }],
      directives: ['Tooltip', 'FocusDirective'],
      inputs: { title: 'Hello', count: 42 },
      outputs: { submit: { ref: 'Block:SomeService.path.handle' } },
    };
    const result = safeParseBlockDescription(desc);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.component).toBe('Layout');
      expect(result.data.id).toBe('MyBlock');
      expect(result.data.inputs).toEqual({ title: 'Hello', count: 42 });
      expect(result.data.outputs).toBeDefined();
      expect(result.data.directives).toEqual(['Tooltip', 'FocusDirective']);
    }
  });

  it('parses directives as a single string', () => {
    const result = safeParseBlockDescription({ component: 'C', directives: 'OneDirective' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.directives).toBe('OneDirective');
  });

  it('accepts output as a non-empty string callable ref', () => {
    const result = safeParseBlockDescription({
      component: 'C',
      outputs: { save: 'Block:Svc.path.method' },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.outputs?.['save']).toBe('Block:Svc.path.method');
  });

  it('accepts nested then chain and onError on output object', () => {
    const result = safeParseBlockDescription({
      component: 'C',
      outputs: {
        done: {
          ref: 'Block:Svc.path.main',
          then: ['Block:Other.path.step', { ref: 'Block:Other.path.next', params: [{ x: 1 }] }],
          onError: { ref: 'Block:Svc.path.err', params: [] },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('normalizes explicit empty services array and null services', () => {
    const a = safeParseBlockDescription({ component: 'C', services: [] });
    const b = safeParseBlockDescription({ component: 'C', services: null });
    expect(a.success && b.success).toBe(true);
    if (a.success) expect(a.data.services).toEqual([]);
    if (b.success) expect(b.data.services).toEqual([]);
  });

  it('accepts service entry with alias', () => {
    expect(
      safeParseBlockDescription({ component: 'C', services: [{ id: 'S', alias: 'myAlias' }] })
        .success,
    ).toBe(true);
  });

  describe('failure cases', () => {
    it('fails when root is not a plain object', () => {
      for (const v of [null, undefined, 'string', 123, []]) {
        expect(safeParseBlockDescription(v).success).toBe(false);
      }
      const r = safeParseBlockDescription([]);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.message).toBe('Expected an object');
    });

    it('fails when component is missing, empty, or wrong type', () => {
      expect(safeParseBlockDescription({}).success).toBe(false);
      expect(safeParseBlockDescription({ id: 'X' }).success).toBe(false);
      expect(safeParseBlockDescription({ component: '' }).success).toBe(false);
      expect(safeParseBlockDescription({ component: 1 }).success).toBe(false);
      expect(safeParseBlockDescription({ component: '  ' }).success).toBe(true);
    });

    it('fails when id is present but not a non-empty string', () => {
      expect(safeParseBlockDescription({ component: 'C', id: '' }).success).toBe(false);
    });

    it.each([
      [{ id: '' }, 'services[0]: service object requires non-empty id'],
      [{ id: 'a', scope: 'root' }, 'services[0]: invalid scope'],
      [{ id: 'a', alias: '' }, 'services[0]: invalid alias'],
    ] as const)('fails invalid service object %j', (entry, msg) => {
      const r = safeParseBlockDescription({ component: 'C', services: [entry] });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.message).toBe(msg);
    });

    it('fails when a service entry is not a string or valid object', () => {
      const r = safeParseBlockDescription({ component: 'C', services: [null as unknown as string] });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.message).toContain('invalid service entry');
    });

    it.each([1, {}] as const)('fails directives wrong shape (%s)', (directives) => {
      expect(
        safeParseBlockDescription({ component: 'C', directives: directives as never }).success,
      ).toBe(false);
    });

    it('fails when a directive id in the array is empty', () => {
      const r = safeParseBlockDescription({ component: 'C', directives: ['A', ''] });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.message).toContain('directives[1]');
    });

    it('fails when inputs is an array', () => {
      const r = safeParseBlockDescription({ component: 'C', inputs: [] as never });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.message).toBe('inputs must be an object');
    });

    it('fails when outputs is not a plain object', () => {
      const r = safeParseBlockDescription({ component: 'C', outputs: [] as never });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.message).toBe('outputs must be an object');
    });

    it.each([
      ['', 'outputs.k'],
      [123, 'outputs.k'],
      [{}, 'outputs.k: output object requires ref'],
      [{ ref: '' }, 'outputs.k: output object requires ref'],
    ] as const)('fails invalid output value', (value, expectedSub) => {
      const r = safeParseBlockDescription({ component: 'C', outputs: { k: value as never } });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.message).toContain(expectedSub);
    });

    it.each([
      [
        { ref: 'Block:A.b.m', params: 'nope' as never },
        'params must be array or record',
      ],
      [{ ref: 'Block:A.b.m', then: 'x' as never }, 'then must be an array'],
      [{ ref: 'Block:A.b.m', then: [{ ref: '' }] }, 'then step object requires ref'],
      [{ ref: 'Block:A.b.m', onError: [] as never }, 'invalid onError'],
      [{ ref: 'Block:A.b.m', onError: {} }, 'onError requires ref'],
    ] as const)('fails invalid output object branch', (outputs, sub) => {
      const r = safeParseBlockDescription({ component: 'C', outputs: { o: outputs } });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.message).toContain(sub);
    });
  });
});
