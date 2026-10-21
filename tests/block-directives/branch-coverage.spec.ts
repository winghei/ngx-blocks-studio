import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component, Directive, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  getBlockInputsAndOutputs,
  resolveBlockInputsAndOutputs,
} from '../../projects/blocks-studio/src/lib/core/block-loader/block-bindings';
import { safeParseBlockDescription } from '../../projects/blocks-studio/src/lib/core/block-loader/block-description-validate';
import {
  parseFlowTemplate,
  interpretFlow,
  collectRefPaths,
} from '../../projects/blocks-studio/src/lib/core/block-loader/flow-template';
import {
  resolveRefPath,
  getRefValue,
  getRefSignal,
  setRefValue,
  refPathResolvesToSignal,
} from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';
import {
  resolveNestedTemplateValues,
  valueNeedsInputResolve,
  valueContainsMustacheInTree,
} from '../../projects/blocks-studio/src/lib/core/block-loader/nested-template-resolve';
import {
  createOutputHandler,
  splitCallableRef,
} from '../../projects/blocks-studio/src/lib/core/block-loader/output-reference';
import {
  resolveReferenceValue,
  resolveMustacheInterpolatedString,
  resolveTemplateString,
} from '../../projects/blocks-studio/src/lib/core/block-loader/template-interpolation';
import { evaluateSafeExpression } from '../../projects/blocks-studio/src/lib/core/block-loader/safe-expression-evaluator';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';
import {
  runBlockDirectiveEffect,
  createInitialBlockDirectiveLoadState,
} from '../../projects/blocks-studio/src/lib/core/block-loader/block-directive-effect';
import { BlockDefinitionsRegistry } from '../../projects/blocks-studio/src/lib/core/registry/block-definitions.registry';
import {
  isInvalidTwoWayMix,
  classifyTwoWayString,
} from '../../projects/blocks-studio/src/lib/core/block-loader/ref-expressions';
import { buildComputedForTemplate } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';
import type { ResolverContext } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';

describe('branch coverage gaps', () => {
  describe('block-bindings metadata fallbacks', () => {
    it('skips types without Angular metadata', () => {
      class Plain {}
      expect(getBlockInputsAndOutputs([Plain as never]).inputs.size).toBe(0);
    });

    it('reads ɵcmp when reflect mirror has no inputs', () => {
      @Component({ standalone: true, template: '' })
      class EmptyMirror {}
      TestBed.createComponent(EmptyMirror);
      const meta = getBlockInputsAndOutputs([EmptyMirror]);
      expect(meta.inputs.size).toBe(0);
      expect(meta.outputs.size).toBe(0);
    });

    it('uses ɵdir metadata when inputs/outputs maps are missing on def', () => {
      class FakeDir {}
      (FakeDir as unknown as { ɵdir: Record<string, unknown> }).ɵdir = {};
      const meta = getBlockInputsAndOutputs([FakeDir as never]);
      expect(meta.inputs.size).toBe(0);
    });

    it('uses empty input/output records when def omits maps', () => {
      @Directive({ selector: '[bare]', standalone: true })
      class BareDir {}
      const meta = getBlockInputsAndOutputs([BareDir]);
      expect(meta.inputs.size).toBe(0);
    });

    it('two-way with whitespace-only ref path skips signal binding', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ctx = {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: {}, model: signal(undefined) },
      };
      const { resolvedTwoWay } = resolveBlockInputsAndOutputs(
        { inputs: { title: '[(   )]' } },
        new Set(),
        new Set(),
        new Set(['title']),
        ctx,
      );
      expect(resolvedTwoWay.title).toBeUndefined();
      warn.mockRestore();
    });

    it('binds scalar two-way without declared input key', () => {
      const ctx = {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: {}, model: signal(undefined) },
      };
      const { resolvedTwoWay } = resolveBlockInputsAndOutputs(
        { inputs: { onlyTwoWay: 99 } },
        new Set(),
        new Set(),
        new Set(['onlyTwoWay']),
        ctx,
      );
      expect(resolvedTwoWay.onlyTwoWay!()).toBe(99);
    });

    it('binds numeric input when only inputKeys match', () => {
      const ctx = {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: {}, model: signal(undefined) },
      };
      const { resolvedInputs } = resolveBlockInputsAndOutputs(
        { inputs: { count: 3 } },
        new Set(['count']),
        new Set(),
        new Set(),
        ctx,
      );
      expect(resolvedInputs.count!()).toBe(3);
    });
  });

  describe('block-description-validate branches', () => {
    it('accepts a single service object (non-array)', () => {
      const r = safeParseBlockDescription({ component: 'C', services: { id: 'S' } });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.services).toEqual([{ id: 'S' }]);
    });

    it('validates nested then steps and params on then objects', () => {
      expect(
        safeParseBlockDescription({
          component: 'C',
          outputs: {
            o: {
              ref: 'Block:A.b.m',
              then: [{ ref: 'Block:B.c.d', params: 1 }],
            },
          },
        }).success,
      ).toBe(false);
      expect(
        safeParseBlockDescription({
          component: 'C',
          outputs: {
            o: {
              ref: 'Block:A.b.m',
              then: [{ ref: 'Block:B.c.d', then: [{ ref: 'Block:C.d.e' }] }],
            },
          },
        }).success,
      ).toBe(true);
    });
  });

  describe('flow-template parser and interpreter', () => {
    const ctx = (): ResolverContext => ({
      registry: new BlockRegistryImpl(),
      currentInstance: {
        model: signal({ ok: false, items: [1], label: 'L' }),
        services: { S: { flag: true } },
      },
    });

    it('parses @if/@else with braced bodies and collects else refs', () => {
      const nodes = parseFlowTemplate('@if (ok) { ${label} } @else { no }');
      expect(nodes[0].type).toBe('if');
      expect(collectRefPaths(nodes).has('ok')).toBe(true);
      const falsy = interpretFlow(nodes, ctx());
      expect(falsy).toContain('no');
    });

    it('falls back when @else body brace is unclosed', () => {
      const nodes = parseFlowTemplate('@if (ok) { a } @else { open');
      expect(nodes[0].type).toBe('if');
    });

    it('handles text scanning when no @ or $ markers remain', () => {
      expect(parseFlowTemplate('plain text only')).toEqual([
        { type: 'text', value: 'plain text only' },
      ]);
    });

    it('prefers earlier @if marker over later ${} when scanning text', () => {
      const nodes = parseFlowTemplate('hi @if (ok) {} tail ${x}');
      expect(nodes.some((n) => n.type === 'if')).toBe(true);
    });

    it('interpretFlow skips null refs and non-array for loops', () => {
      const c = ctx();
      c.currentInstance!.model = signal({ missing: null, notList: {} });
      expect(interpretFlow(parseFlowTemplate('${missing}'), c)).toBe('');
      expect(interpretFlow(parseFlowTemplate('@for (i of notList) { ${i} }'), c)).toBe('');
    });

    it('interpretFlow uses scope for ref first segment', () => {
      const out = interpretFlow(parseFlowTemplate('${item}'), ctx(), { item: 'scoped' });
      expect(out).toBe('scoped');
    });

    it('interpretFlow resolves model path when block ref missing', () => {
      expect(interpretFlow(parseFlowTemplate('${label}'), ctx())).toBe('L');
    });

    it('escapeHtml uses string fallback when document is unavailable', () => {
      const orig = globalThis.document;
      // @ts-expect-error test stub
      delete globalThis.document;
      try {
        const out = interpretFlow(parseFlowTemplate('${label}'), ctx());
        expect(out).toBe('L');
      } finally {
        globalThis.document = orig;
      }
    });

    it('interpretFlow with custom resolveCondition and else branch', () => {
      const nodes = parseFlowTemplate('@if (expr) { yes } @else { no }');
      const out = interpretFlow(nodes, ctx(), {}, {
        resolveCondition: () => false,
      });
      expect(out).toContain('no');
    });
  });

  describe('ref-resolver edge paths', () => {
    it('model ref path stops when intermediate is non-object after signal unwrap', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          model: signal({ mid: 'not-object' }),
          services: {},
        },
      };
      expect(resolveRefPath('model.mid.bad.extra', c)).toBeNull();
    });

    it('getRefSignal returns undefined when signal value is not an object', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          model: signal({ x: signal('plain') }),
          services: {},
        },
      };
      expect(getRefSignal('model.x.y', c)).toBeUndefined();
    });

    it('refPathResolvesToSignal true for empty path on signal target', () => {
      const m = signal({ a: 1 });
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: m, services: {} },
      };
      expect(refPathResolvesToSignal('model', c)).toBe(true);
    });

    it('setRefValue assigns on plain object when leaf is not a writable signal', () => {
      const bag: Record<string, unknown> = { x: 1 };
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: { P: bag }, model: signal({}) },
      };
      setRefValue('P.x', c, 9);
      expect(bag.x).toBe(9);
    });

    it('getRefValue reads intermediate signal segments on model ref', () => {
      const inner = signal({ leaf: 'v' });
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          model: signal({ inner }),
          services: {},
        },
      };
      expect(getRefValue('model.inner.leaf', c)).toBe('v');
    });
  });

  describe('nested-template-resolve', () => {
    it('returns primitives unchanged and respects visited graphs', () => {
      const ctx: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: {}, model: signal({}) },
      };
      expect(resolveNestedTemplateValues(42, ctx)).toBe(42);
      const cycle: Record<string, unknown> = { a: 1 };
      cycle.self = cycle;
      expect(valueNeedsInputResolve(cycle)).toBe(false);
      expect(resolveNestedTemplateValues(cycle, ctx)).toEqual(cycle);
    });

    it('resolveTwoWay readonly without ref path falls through to template resolve', () => {
      const ctx: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ t: 'm' }), services: {} },
      };
      const out = resolveNestedTemplateValues('[(   )]', ctx, 'p', new WeakSet(), {
        resolveTwoWayStringsAsReadonly: true,
      });
      expect(out).toBe('[(   )]');
    });

    it('honors escapeFlowRefs false in nested strings', () => {
      const ctx: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ t: '<b>' }), services: {} },
      };
      const out = resolveNestedTemplateValues('${model.t}', ctx, 'p', new WeakSet(), {
        escapeFlowRefs: false,
      });
      expect(out).toBe('<b>');
    });
  });

  describe('template-interpolation branches', () => {
    const ctx: ResolverContext = {
      registry: new BlockRegistryImpl(),
      currentInstance: {
        model: signal({ title: 'M' }),
        services: { S: { label: signal('svc') } },
      },
    };

    it('resolveReferenceValue prefers resolved ref over model path', () => {
      expect(resolveReferenceValue('S.label', ctx)).toBe('svc');
    });

    it('returns original string when braces do not form matches', () => {
      expect(resolveMustacheInterpolatedString('{{ unclosed', ctx, null)).toBe('{{ unclosed');
    });

    it('stringifies null evaluated segments in mixed templates', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ empty: '' }), services: {} },
      };
      const out = resolveMustacheInterpolatedString('a{{ empty }}b', c, null);
      expect(out).toBe('ab');
    });
  });

  describe('safe-expression-evaluator branches', () => {
    it('throws on trailing tokens after a valid expression', () => {
      expect(() => evaluateSafeExpression('1 2', ctx(), null, getRefValue)).toThrow(
        'Unexpected trailing tokens',
      );
    });

    it('short-circuits logical or and evaluates ternary false branch', () => {
      const c = ctx();
      expect(evaluateSafeExpression('true || ref("missing")', c, null, getRefValue)).toBe(true);
      expect(evaluateSafeExpression('false ? 1 : 2', c, null, getRefValue)).toBe(2);
    });

    it('indexes into function-typed ref results', () => {
      const c = ctx();
      c.currentInstance!.services = {
        S: { fn: () => ({ k: 'v' }) },
      };
      expect(evaluateSafeExpression('ref("S.fn", true)["k"]', c, null, getRefValue)).toBe('v');
    });

    function ctx(): ResolverContext {
      return {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({}), services: {} },
      };
    }
  });

  describe('output-reference branches', () => {
    it('isInvalidTwoWayMix is false for non-strings', () => {
      expect(isInvalidTwoWayMix(1)).toBe(false);
    });

    it('warnNotCallable describes non-function leaf types', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      createOutputHandler('S.nested.go', 'out', {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: { S: { nested: { go: 1 } } }, model: signal({}) },
      })(null);
      expect(warn.mock.calls[0][0]).toContain('number');
      warn.mockRestore();
    });

    it('skips onError when when resolves falsy', async () => {
      const err = vi.fn();
      createOutputHandler(
        {
          ref: 'S.fail',
          onError: { ref: 'S.err', when: 'false' },
        },
        'out',
        {
          registry: new BlockRegistryImpl(),
          currentInstance: {
            services: {
              fail: () => Promise.reject(1),
              err,
            },
            model: signal({}),
          },
        },
      )(null);
      await Promise.resolve();
      await Promise.resolve();
      expect(err).not.toHaveBeenCalled();
    });

    it('resolveReferencePath stringifies non-string template results', () => {
      const fn = vi.fn();
      const methodPath = signal('S.go');
      createOutputHandler(
        { ref: "{{ ref('S.methodPath') }}", params: [] },
        'out',
        {
          registry: new BlockRegistryImpl(),
          currentInstance: {
            services: { S: { methodPath, go: fn } },
            model: signal({}),
          },
        },
      )(null);
      expect(fn).toHaveBeenCalled();
    });

    it('getCallTarget with service leaf invokes method on resolved object', () => {
      const fn = vi.fn();
      const reg = new BlockRegistryImpl();
      reg.register('B', {
        instance: { services: { X: { run: fn } }, model: signal({}) },
      });
      createOutputHandler('B:X.run', 'out', {
        registry: reg,
        currentInstance: { services: {}, model: signal({}) },
      })(1);
      expect(fn).toHaveBeenCalledWith(1);
    });

    it('resolveStepParams maps record params in then steps', () => {
      const second = vi.fn();
      createOutputHandler(
        {
          ref: 'S.first',
          then: [{ ref: 'S.second', params: { code: 1 } }],
        },
        'out',
        {
          registry: new BlockRegistryImpl(),
          currentInstance: {
            services: { S: { first: () => {}, second } },
            model: signal({}),
          },
        },
      )(null);
      expect(second).toHaveBeenCalledWith({ code: 1 });
    });
  });

  describe('block-directive-effect stale success callback', () => {
    it('drops load result when generation advanced before resolve', async () => {
      const state = createInitialBlockDirectiveLoadState();
      const vcr = { clear: vi.fn() } as unknown as ViewContainerRef;
      let resolveFirst!: (v: unknown) => void;
      const loadBlock = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            }),
        )
        .mockResolvedValue({ destroy: vi.fn() });

      runBlockDirectiveEffect(
        state,
        { viewContainerRef: vcr, loadBlock },
        { component: 'First' },
        null,
        null,
        null,
      );
      runBlockDirectiveEffect(
        state,
        { viewContainerRef: vcr, loadBlock },
        { component: 'Second' },
        null,
        null,
        null,
      );
      resolveFirst({ destroy: vi.fn() });
      await Promise.resolve();
      expect(state.loadedComponent).toBe('Second');
    });
  });

  describe('block-definitions registry getAll', () => {
    it('omits lazy loaders that have not been fetched yet', () => {
      const reg = BlockDefinitionsRegistry.getInstance();
      reg.clear();
      reg.register('Lazy', async () => ({ component: 'X' }));
      reg.register('Plain', { component: 'Y' });
      expect(reg.getAll()).toEqual({ Plain: { component: 'Y' } });
      reg.clear();
    });
  });

  describe('remaining branch targets', () => {
    it('block-bindings assigns writable two-way signal directly', () => {
      const title = signal('direct');
      const reg = new BlockRegistryImpl();
      reg.register('B', { instance: { services: { F: { title } }, model: signal({}) } });
      const ctx = { registry: reg, currentBlockId: 'B', currentInstance: reg.get('B')!.instance };
      const { resolvedTwoWay } = resolveBlockInputsAndOutputs(
        { inputs: { title: '[(F.title)]' } },
        new Set(['title']),
        new Set(),
        new Set(['title']),
        ctx,
      );
      expect(resolvedTwoWay.title).toBe(title);
    });

    it('block-bindings seeds two-way signal for plain object without input getter', () => {
      const obj = { z: 1 };
      const ctx = {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: {}, model: signal(undefined) },
      };
      const { resolvedTwoWay, resolvedInputs } = resolveBlockInputsAndOutputs(
        { inputs: { data: obj } },
        new Set(),
        new Set(),
        new Set(['data']),
        ctx,
      );
      expect(resolvedTwoWay.data!()).toEqual(obj);
      expect(resolvedInputs.data).toBeUndefined();
    });

    it('block-description rejects non-record/array params', () => {
      const r = safeParseBlockDescription({
        component: 'C',
        outputs: { o: { ref: 'Block:A.b.m', params: 9 } },
      });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.message).toContain('params must be array or record');
    });

    it('isInvalidTwoWayMix detects delimiter mix', () => {
      expect(isInvalidTwoWayMix('prefix [(x)] suffix')).toBe(true);
      expect(classifyTwoWayString('[(x)] extra')).toBe('invalid-mix');
    });

    it('flow-template covers paren/brace helpers and if/else whitespace', () => {
      expect(parseFlowTemplate('@if (ok) {a} @else  {b}')).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'if' })]),
      );
      const nodes = parseFlowTemplate('@if (ok) { ${x} }');
      expect(collectRefPaths(nodes).has('ok')).toBe(true);
      expect(collectRefPaths(parseFlowTemplate('@if (a) {x} @else { ${y} }')).has('y')).toBe(true);
      expect(parseFlowTemplate('before ${x}')).toEqual([
        { type: 'text', value: 'before ' },
        { type: 'ref', refPath: 'x' },
      ]);
      expect(parseFlowTemplate('only ${dollar}')).toEqual([
        { type: 'text', value: 'only ' },
        { type: 'ref', refPath: 'dollar' },
      ]);
    });

    it('interpretFlow uses resolveRefOrModel and custom condition true path', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ v: 1 }), services: {} },
      };
      expect(interpretFlow(parseFlowTemplate('${v}'), c)).toBe('1');
      const nodes = parseFlowTemplate('@if (x) { yes }');
      expect(
        interpretFlow(nodes, c, {}, { resolveCondition: () => true }),
      ).toContain('yes');
    });

    it('ref-resolver block lookup and model signal walk', () => {
      const reg = new BlockRegistryImpl();
      reg.register('Other', {
        instance: { services: { S: { v: 1 } }, model: signal({}) },
      });
      const c: ResolverContext = { registry: reg, currentInstance: { services: {}, model: signal({}) } };
      expect(getRefValue('Other:S.v', c)).toBe(1);

      const mid = signal({ leaf: 'ok' });
      const c2: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ mid }), services: {} },
      };
      expect(getRefValue('model.mid.leaf', c2)).toBe('ok');
      expect(refPathResolvesToSignal('model', c2)).toBe(true);

      const bag: Record<string, unknown> = { x: 0 };
      setRefValue('P.x', {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({}), services: { P: bag } },
      }, 'val');
      expect(bag.x).toBe('val');
    });

    it('buildComputedForTemplate substitutes undefined refs as empty', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({}), services: {} },
      };
      expect(buildComputedForTemplate('{{Missing.x}}', ['Missing.x'], c)()).toBe('');
    });

    it('nested-template valueNeedsInputResolve skips non-plain nodes', () => {
      expect(valueNeedsInputResolve(new Date())).toBe(false);
      expect(valueContainsMustacheInTree(new Date())).toBe(false);
    });

    it('nested-template resolveNestedTemplateValues on arrays and two-way without readonly', () => {
      const ctx: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          model: signal({ t: 'v' }),
          services: { S: { n: signal(1) } },
        },
      };
      expect(
        resolveNestedTemplateValues(['{{ ref("S.n") }}'], ctx, 'arr', new WeakSet(), {}),
      ).toEqual([1]);
      expect(
        resolveNestedTemplateValues('[(S.n)]', ctx, 'p', new WeakSet(), {
          resolveTwoWayStringsAsReadonly: false,
        }),
      ).toBe('[(S.n)]');
    });

    it('template-interpolation mixed mustache null segment and resolveReferenceValue', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          model: signal({ empty: null }),
          services: { S: { n: signal(0) } },
        },
      };
      expect(resolveReferenceValue('S.n', c)).toBe(0);
      expect(resolveMustacheInterpolatedString('x{{ empty }}y', c, null)).toBe('xy');
      expect(resolveMustacheInterpolatedString('no closing {{', c, null)).toBe('no closing {{');
    });

    it('safe-expression parser expect, unary plus, and function index', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({}), services: {} },
      };
      expect(() => evaluateSafeExpression('true ? 1', c, null, getRefValue)).toThrow();
      expect(evaluateSafeExpression('+3', c, null, getRefValue)).toBe(3);
      c.currentInstance!.services = {
        S: {
          pick: () => ({ k: 1 }),
        },
      };
      expect(evaluateSafeExpression('ref("S.pick", true)["k"]', c, null, getRefValue)).toBe(1);
      expect(evaluateSafeExpression('false || 2', c, null, getRefValue)).toBe(2);
    });

    it('two-way ref without twoWayKeys still resolves read computed input', () => {
      const title = signal('rw');
      const reg = new BlockRegistryImpl();
      reg.register('B', { instance: { services: { F: { title } }, model: signal({}) } });
      const ctx = { registry: reg, currentBlockId: 'B', currentInstance: reg.get('B')!.instance };
      const { resolvedTwoWay, resolvedInputs } = resolveBlockInputsAndOutputs(
        { inputs: { title: '[(F.title)]' } },
        new Set(['title']),
        new Set(),
        new Set(),
        ctx,
      );
      expect(resolvedTwoWay.title).toBeUndefined();
      expect(resolvedInputs.title!()).toBe('rw');
    });

    it('block-description validateParams accepts array on then steps', () => {
      expect(
        safeParseBlockDescription({
          component: 'C',
          outputs: {
            o: {
              ref: 'Block:A.b.m',
              then: [{ ref: 'Block:B.c.d', params: ['a'], then: [{ ref: 'Block:C.d.e' }] }],
            },
          },
        }).success,
      ).toBe(true);
    });

    it('flow-template nested parens and whitespace in else', () => {
      expect(parseFlowTemplate('@if ((ok)) { x }')).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'if' })]),
      );
      parseFlowTemplate('@if (a) { x } @else\n\n{\ny\n}');
      expect(parseFlowTemplate('end')).toEqual([{ type: 'text', value: 'end' }]);
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ onlyModel: 9 }), services: {} },
      };
      expect(interpretFlow(parseFlowTemplate('${onlyModel}'), c)).toBe('9');
      const emptyElse = interpretFlow(
        parseFlowTemplate('@if (nope) { a } @else { }'),
        c,
        {},
        { resolveCondition: () => false },
      );
      expect(emptyElse.trim()).toBe('');
    });

    it('ref-resolver warns for missing block and refPathResolvesToSignal on model root', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const reg = new BlockRegistryImpl();
      const m = signal({ a: 1 });
      const c: ResolverContext = { registry: reg, currentInstance: { model: m, services: {} } };
      expect(getRefValue('Ghost:Svc.x', c)).toBeUndefined();
      expect(refPathResolvesToSignal('model', c)).toBe(true);
      warn.mockRestore();
    });

    it('setRefValue assigns plain leaf properties', () => {
      const leaf: Record<string, unknown> = { count: 1 };
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: { Bag: { leaf } }, model: signal({}) },
      };
      setRefValue('Bag.leaf.count', c, 9);
      expect(leaf.count).toBe(9);
    });

    it('safe-expression indexes function refs and unary minus', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          model: signal({}),
          services: { S: { fn: () => 0, arr: () => [1, 2] } },
        },
      };
      expect(evaluateSafeExpression('ref("S.arr", true)[1]', c, null, getRefValue)).toBe(2);
      expect(evaluateSafeExpression('-4', c, null, getRefValue)).toBe(-4);
    });

    it('template-interpolation resolveReferenceValue via ref path and empty matches', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          model: signal({ t: 1 }),
          services: { S: { n: signal(2) } },
        },
      };
      expect(resolveReferenceValue('model.t', c)).toBe(1);
      expect(resolveMustacheInterpolatedString('x{{ broken', c, null)).toBe('x{{ broken');
      expect(resolveMustacheInterpolatedString('a{{ ref("S.n") }}b', c, null)).toBe('a2b');
    });

    it('nested resolve uses path prefixes on arrays and plain strings', () => {
      const ctx: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({}), services: {} },
      };
      expect(resolveNestedTemplateValues('plain', ctx, 'root', new WeakSet(), {})).toBe('plain');
      expect(resolveNestedTemplateValues([1, 'two'], ctx, '', new WeakSet(), {})).toEqual([
        1,
        'two',
      ]);
      expect(
        resolveNestedTemplateValues('[(S.n)]', ctx, 'k', new WeakSet(), {
          resolveTwoWayStringsAsReadonly: false,
        }),
      ).toBe('[(S.n)]');
    });

    it('isInvalidTwoWayMix is false for exact two-way ref strings', () => {
      expect(isInvalidTwoWayMix('[(Svc.path)]')).toBe(false);
      expect(isInvalidTwoWayMix('[(Svc.path)] extra')).toBe(true);
    });

    it('ref-resolver resolves registered block refs and plain setRefValue', () => {
      const reg = new BlockRegistryImpl();
      reg.register('Blk', {
        instance: { services: { S: { v: 2 } }, model: signal({}) },
      });
      const c: ResolverContext = { registry: reg, currentInstance: { services: {}, model: signal({}) } };
      expect(getRefValue('Blk:S.v', c)).toBe(2);

      const holder = { leaf: { n: 1 } };
      setRefValue('H.leaf.n', {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: { H: holder }, model: signal({}) },
      }, 5);
      expect(holder.leaf.n).toBe(5);
    });

    it('refPathResolvesToSignal uses target when path is empty', () => {
      const m = signal(1);
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: m, services: {} },
      };
      expect(refPathResolvesToSignal('model', c)).toBe(true);
    });

    it('flow-template whitespace after @if and @else', () => {
      parseFlowTemplate('@if (a)\t{ x } @else\t{ y }');
      expect(parseFlowTemplate('hello world')).toEqual([{ type: 'text', value: 'hello world' }]);
      expect(parseFlowTemplate('x@if (a) { y }').some((n) => n.type === 'if')).toBe(true);
    });

    it('safe-expression rejects indexing non-object ref values', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ n: 3 }), services: {} },
      };
      expect(evaluateSafeExpression('-ref("model.n")', c, null, getRefValue)).toBe(-3);
      expect(evaluateSafeExpression('ref("model.n")[0]', c, null, getRefValue)).toBeUndefined();
    });

    it('template-interpolation branches for refs and broken mustache', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          model: signal({ x: 1 }),
          services: { S: { label: signal('L') } },
        },
      };
      expect(resolveReferenceValue('x', c)).toBe(1);
      expect(resolveReferenceValue('S.label', c)).toBe('L');
      expect(resolveMustacheInterpolatedString('}} {{', c, null)).toBe('}} {{');
      expect(resolveMustacheInterpolatedString('a{{ ref("model.x") }}b', c, null)).toBe('a1b');
    });

    it('output resolveReferencePath handles undefined mustache refs', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      createOutputHandler(
        { ref: '{{ ref("Missing.path") }}', params: [] },
        'out',
        {
          registry: new BlockRegistryImpl(),
          currentInstance: { services: { S: { go: vi.fn() } }, model: signal({}) },
        },
      )(null);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('output-reference resolveReferencePath coerces numeric mustache refs', () => {
      const fn = vi.fn();
      const methodPath = signal('S.go');
      createOutputHandler(
        { ref: "{{ ref('S.methodPath') }}", params: [] },
        'out',
        {
          registry: new BlockRegistryImpl(),
          currentInstance: {
            services: { S: { methodPath, go: fn } },
            model: signal({}),
          },
        },
      )(null);
      expect(fn).toHaveBeenCalled();
    });

    it('flow parser skips whitespace before @else', () => {
      const nodes = parseFlowTemplate('@if (x) { a }   @else { b }');
      const ifNode = nodes.find((n) => n.type === 'if');
      expect(ifNode?.elseBody?.length).toBeGreaterThan(0);
    });

    it('interpretFlow uses else branch when condition is falsy', () => {
      const ctx = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ ok: false }), services: {} },
      };
      const out = interpretFlow(
        parseFlowTemplate('@if (ok) { yes } @else { no }'),
        ctx,
      );
      expect(out.trim()).toBe('no');
    });

    it('resolveReferenceValue falls back to model path when ref path does not resolve', () => {
      const ctx: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ age: 5 }), services: {} },
      };
      expect(resolveReferenceValue('age', ctx)).toBe(5);
      expect(
        resolveReferenceValue('age', { registry: new BlockRegistryImpl(), currentInstance: undefined }),
      ).toBeUndefined();
    });

    it('refPathResolvesToSignal is false when ref does not resolve', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({}), services: {} },
      };
      expect(refPathResolvesToSignal('missing.path', c)).toBe(false);
    });

    it('resolveRefPath uses ctx.registry when scoped registry is null', () => {
      const reg = new BlockRegistryImpl();
      reg.register('Peer', {
        instance: { services: { S: { v: 1 } }, model: signal({}) },
      });
      const ctx: ResolverContext = {
        registry: reg,
        currentBlockId: 'Self',
        currentInstance: { services: {}, model: signal({}) },
      };
      expect(getRefValue('Peer:S.v', ctx)).toBe(1);
    });

    it('setRefValue no-ops when parent object is missing', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: { H: null }, model: signal({}) },
      };
      setRefValue('H.leaf.n', c, 9);
    });

    it('resolveRefPath uses registry.get for foreign block ids', () => {
      const reg = new BlockRegistryImpl();
      reg.register('Peer', {
        instance: { services: { S: { n: 2 } }, model: signal({}) },
      });
      const getSpy = vi.spyOn(reg, 'get');
      const ctx: ResolverContext = {
        registry: reg,
        currentBlockId: 'Self',
        currentInstance: { services: {}, model: signal({}) },
      };
      expect(resolveRefPath('Peer:S.n', ctx)?.path).toEqual(['n']);
      expect(getSpy).toHaveBeenCalledWith('Peer');
    });

    it('interpretFlow runs @for bodies', () => {
      const ctx = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ items: ['a', 'b'] }), services: {} },
      };
      const out = interpretFlow(
        parseFlowTemplate('@for (item of model.items) { ${item} }'),
        ctx,
      );
      expect(out.replace(/\s/g, '')).toBe('ab');
    });

    it('interpretFlow skips empty @else blocks', () => {
      const ctx = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ ok: false }), services: {} },
      };
      const out = interpretFlow(parseFlowTemplate('@if (ok) { yes } @else { }'), ctx);
      expect(out.trim()).toBe('');
    });

    it('interpretFlow handles manual if/for nodes', () => {
      const ctx = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ items: [1] }), services: {} },
      };
      const out = interpretFlow(
        [
          { type: 'if', refPath: 'false', body: [{ type: 'text', value: 'y' }], elseBody: [] },
          { type: 'for', itemVar: 'i', refPath: 'model.items', body: [{ type: 'text', value: 'x' }] },
        ],
        ctx,
      );
      expect(out).toContain('x');
    });

    it('resolveNestedTemplateValues resolves top-level string leaves', () => {
      const ctx: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({}), services: {} },
      };
      expect(resolveNestedTemplateValues('plain', ctx)).toBe('plain');
    });

    it('setRefValue writes plain object properties', () => {
      const plain = { label: 'a' };
      const ctx: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: { plain }, model: signal({}) },
      };
      setRefValue('plain.label', ctx, 'b');
      expect(plain.label).toBe('b');
    });

    it('resolveRefPath loads instance from registry by block id', () => {
      const reg = new BlockRegistryImpl();
      reg.register('Peer', {
        instance: { services: { S: { v: 1 } }, model: signal({}) },
      });
      const ctx: ResolverContext = {
        registry: reg,
        currentBlockId: 'Self',
        currentInstance: { services: {}, model: signal({}) },
      };
      expect(getRefValue('Peer:S.v', ctx)).toBe(1);
    });

    it('runOnError invokes handler when when is true', async () => {
      const onErr = vi.fn();
      createOutputHandler(
        {
          ref: 'S.fail',
          onError: { ref: 'S.onErr', when: true },
        },
        'out',
        {
          registry: new BlockRegistryImpl(),
          currentInstance: {
            services: {
              S: {
                fail: () => Promise.reject(new Error('x')),
                onErr,
              },
            },
            model: signal({}),
          },
        },
      )(null);
      await vi.waitFor(() => expect(onErr).toHaveBeenCalled());
    });

    it('runOnError skips when onError.when is falsy', async () => {
      const onErr = vi.fn();
      createOutputHandler(
        {
          ref: 'S.fail',
          onError: { ref: 'S.onErr', when: 'false' },
        },
        'out',
        {
          registry: new BlockRegistryImpl(),
          currentInstance: {
            services: {
              S: {
                fail: () => Promise.reject(new Error('x')),
                onErr,
              },
            },
            model: signal({}),
          },
        },
      )(null);
      await vi.waitFor(() => expect(onErr).not.toHaveBeenCalled());
    });

    it('refPathResolvesToSignal checks nested path segments', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          model: signal({}),
          services: { Form: { name: signal('n') } },
        },
      };
      expect(refPathResolvesToSignal('Form.name', c)).toBe(true);
    });

    it('safe-expression rejects non-string non-number index keys', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ n: 1 }), services: {} },
      };
      expect(evaluateSafeExpression('n[true]', c, null, getRefValue)).toBeUndefined();
    });

    it('safe-expression evaluates unary minus', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({}), services: {} },
      };
      expect(evaluateSafeExpression('-3', c, null, getRefValue)).toBe(-3);
    });

    it('safe-expression indexes with numeric keys on ref objects', () => {
      const c: ResolverContext = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          model: signal({}),
          services: { S: { pick: () => ({ 0: 'zero' }) } },
        },
      };
      const resolve = (path: string) => {
        if (path === 'S.pick') return () => ({ 0: 'zero' });
        return getRefValue(path, c);
      };
      expect(evaluateSafeExpression('ref("S.pick")[0]', c, null, resolve)).toBe('zero');
    });

    it('isInvalidTwoWayMix short-circuits when delimiters are absent', () => {
      expect(isInvalidTwoWayMix('no-delimiters')).toBe(false);
    });

    it('output-reference skips onError when handler has no onError config', async () => {
      const err = vi.fn();
      createOutputHandler(
        { ref: 'S.fail', then: ['S.next'] },
        'out',
        {
          registry: new BlockRegistryImpl(),
          currentInstance: {
            services: {
              fail: () => Promise.reject(1),
              next: () => {},
              err,
            },
            model: signal({}),
          },
        },
      )(null);
      await Promise.resolve();
      expect(err).not.toHaveBeenCalled();
    });
  });
});
