import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Component,
  Directive,
  Injectable,
  Injector,
  Input,
  ViewChild,
  ViewContainerRef,
  model,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { createInputBindingsWithWarnings } from '../../projects/blocks-studio/src/lib/core/block-loader/block-loader.service';
import { BlockLoaderService } from '../../projects/blocks-studio/src/lib/core/block-loader/block-loader.service';
import { ComponentRegistry } from '../../projects/blocks-studio/src/lib/core/registry/component.registry';
import { DirectiveRegistry } from '../../projects/blocks-studio/src/lib/core/registry/directive.registry';
import { GuardRegistry } from '../../projects/blocks-studio/src/lib/core/registry/guard.registry';
import { ServiceRegistry } from '../../projects/blocks-studio/src/lib/core/registry/service.registry';
import { BlockDefinitionsRegistry } from '../../projects/blocks-studio/src/lib/core/registry/block-definitions.registry';
import { RegistryMetadataStore } from '../../projects/blocks-studio/src/lib/core/registry/registry-metadata';
import { RouteLoader } from '../../projects/blocks-studio/src/lib/core/services/router-loader.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { evaluateSafeExpression } from '../../projects/blocks-studio/src/lib/core/block-loader/safe-expression-evaluator';
import { getRefValue, resolveRefPath } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';
import { classifyTwoWayString } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-expressions';
import { createOutputHandler } from '../../projects/blocks-studio/src/lib/core/block-loader/output-reference';
import { interpretFlow, parseFlowTemplate } from '../../projects/blocks-studio/src/lib/core/block-loader/flow-template';
import {
  runBlockDirectiveEffect,
  createInitialBlockDirectiveLoadState,
} from '../../projects/blocks-studio/src/lib/core/block-loader/block-directive-effect';
import { valueNeedsInputResolve } from '../../projects/blocks-studio/src/lib/core/block-loader/nested-template-resolve';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';

type LoadedMaps = {
  loadedComponents?: Map<string, unknown>;
  loadedDirectives?: Map<string, unknown>;
  loadedGuards?: Map<string, unknown>;
  loadedServices?: Map<string, unknown>;
  loadedDefinitions?: Map<string, unknown>;
};

function dropLoadedCache(registry: LoadedMaps, mapKey: keyof LoadedMaps, id: string): void {
  registry[mapKey]?.delete(id);
}

@Component({ standalone: true, template: '<ng-container #h></ng-container>' })
class VcrHost {
  @ViewChild('h', { read: ViewContainerRef }) vcr!: ViewContainerRef;
}

@Component({ standalone: true, template: '' })
class OutC {
  @Input() title = '';
}

@Component({ standalone: true, template: '' })
class TwoWayM {
  label = model('init');
}

@Injectable()
class SelfModelSvc {
  model = signal<unknown>(undefined);
  setModel = vi.fn();
}

describe('coverage 100% completion', () => {
  beforeEach(() => RegistryMetadataStore.getInstance().clear());

  describe('registry get paths without preload cache', () => {
    it('ComponentRegistry get/getSync repopulates cache', async () => {
      @Component({ template: '' })
      class C {}
      const r = ComponentRegistry.getInstance();
      r.clear();
      r.register('C', C);
      dropLoadedCache(r as LoadedMaps, 'loadedComponents', 'C');
      expect(await r.get('C')).toBe(C);
      dropLoadedCache(r as LoadedMaps, 'loadedComponents', 'C');
      expect(r.getSync('C')).toBe(C);
      r.clear();
    });

    it('DirectiveRegistry get/getSync/getAll repopulates cache', async () => {
      @Directive({ selector: '[x]', standalone: true })
      class D {}
      const r = DirectiveRegistry.getInstance();
      r.clear();
      r.register('D', D);
      dropLoadedCache(r as LoadedMaps, 'loadedDirectives', 'D');
      expect(await r.get('D')).toBe(D);
      dropLoadedCache(r as LoadedMaps, 'loadedDirectives', 'D');
      expect(r.getSync('D')).toBe(D);
      await r.get('D');
      expect(r.getAll().get('D')).toBe(D);
      r.clear();
    });

    it('GuardRegistry get/getSync repopulates cache', async () => {
      const r = GuardRegistry.getInstance();
      r.clear();
      const g = (() => true) as never;
      Object.defineProperty(g, 'length', { value: 1 });
      r.register('g', g);
      dropLoadedCache(r as LoadedMaps, 'loadedGuards', 'g');
      expect(await r.get('g')).toBe(g);
      dropLoadedCache(r as LoadedMaps, 'loadedGuards', 'g');
      expect(r.getSync('g')).toBe(g);
      r.clear();
    });

    it('ServiceRegistry getType/getTypeSync repopulates cache', async () => {
      @Injectable()
      class S {}
      const r = ServiceRegistry.getInstance();
      r.clear();
      await TestBed.configureTestingModule({ providers: [S] }).compileComponents();
      r.setInjector(TestBed.inject(Injector));
      r.register('S', S);
      dropLoadedCache(r as LoadedMaps, 'loadedServices', 'S');
      expect(await r.getType('S')).toBe(S);
      dropLoadedCache(r as LoadedMaps, 'loadedServices', 'S');
      expect(r.getTypeSync('S')).toBe(S);
      r.clear();
    });

    it('BlockDefinitionsRegistry get/getSync repopulates cache', async () => {
      const r = BlockDefinitionsRegistry.getInstance();
      r.clear();
      r.register('d', { x: 1 });
      dropLoadedCache(r as LoadedMaps, 'loadedDefinitions', 'd');
      expect(await r.get('d')).toEqual({ x: 1 });
      dropLoadedCache(r as LoadedMaps, 'loadedDefinitions', 'd');
      expect(r.getSync('d')).toEqual({ x: 1 });
      r.clear();
    });
  });

  describe('createInputBindingsWithWarnings', () => {
    it('builds two-way binding via linkedSignal when only input getter exists', () => {
      const s = signal(1);
      const bindings = createInputBindingsWithWarnings(
        'test',
        new Set(),
        new Set(['x']),
        new Set(),
        { x: () => s() },
        {},
        {},
      );
      expect(bindings.length).toBe(1);
    });

    it('skips keys with no resolved values', () => {
      expect(
        createInputBindingsWithWarnings(
          'test',
          new Set(['a']),
          new Set(['b']),
          new Set(['c']),
          {},
          {},
          {},
        ),
      ).toEqual([]);
    });

    it('includes output bindings when handlers exist', () => {
      const fn = vi.fn();
      const bindings = createInputBindingsWithWarnings(
        'test',
        new Set(),
        new Set(),
        new Set(['save']),
        {},
        {},
        { save: fn },
      );
      expect(bindings.length).toBe(1);
    });
  });

  describe('BlockLoaderService branches', () => {
    let loader: BlockLoaderService;
    let fixture: ComponentFixture<VcrHost>;
    let vcr: ViewContainerRef;
    let componentRegistry: ComponentRegistry;
    let serviceRegistry: ServiceRegistry;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [VcrHost],
        providers: [BlockLoaderService, SelfModelSvc],
      }).compileComponents();
      loader = TestBed.inject(BlockLoaderService);
      fixture = TestBed.createComponent(VcrHost);
      fixture.detectChanges();
      vcr = fixture.componentInstance.vcr;
      componentRegistry = ComponentRegistry.getInstance();
      serviceRegistry = ServiceRegistry.getInstance();
      componentRegistry.register('OutC', OutC);
      componentRegistry.register('TwoWayM', TwoWayM);
      serviceRegistry.register('SelfModelSvc', SelfModelSvc);
    });

    afterEach(() => {
      componentRegistry.unregister('OutC');
      componentRegistry.unregister('TwoWayM');
      serviceRegistry.unregister('SelfModelSvc');
    });

    it('warns when root service alias is reserved', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await loader.load(
        { component: 'OutC', services: [{ id: 'SelfModelSvc', alias: 'model' }] },
        vcr,
        signal({ a: 1 }),
      );
      fixture.detectChanges();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('reserved'));
      result.destroy();
      warn.mockRestore();
    });

    it('warns when self service alias is reserved', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await loader.load(
        {
          component: 'OutC',
          services: [{ id: 'SelfModelSvc', scope: 'self', alias: 'services' }],
        },
        vcr,
        signal({ a: 1 }),
      );
      fixture.detectChanges();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('reserved'));
      result.destroy();
      warn.mockRestore();
    });

    it('resolves string model via ref signal and fallbacks', async () => {
      const registry = new BlockRegistryImpl();
      registry.register('B', {
        instance: { services: {}, model: signal({ t: 'v' }) },
      });
      const r1 = await loader.load({ component: 'OutC' }, vcr, signal('B:model.t'), { registry });
      fixture.detectChanges();
      r1.destroy();

      const r2 = await loader.load({ component: 'OutC' }, vcr, signal('{{ model.n }}'));
      fixture.detectChanges();
      r2.destroy();

      const r3 = await loader.load({ component: 'OutC' }, vcr, signal('NotARef:model.x'));
      fixture.detectChanges();
      r3.destroy();
    });

    it('throws when model resolves but block instance is missing', () => {
      const registry = new BlockRegistryImpl();
      const ctx = {
        registry,
        currentInstance: undefined,
      };
      expect(() =>
        (loader as unknown as { resolveContextModel: (c: unknown, m: unknown) => void }).resolveContextModel(
          ctx,
          signal('x'),
        ),
      ).toThrow('Block instance not found');
    });
  });

  describe('expression and template edges', () => {
    it('safe-expression decimal and bad primary', () => {
      const c = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          model: signal({}),
          services: { S: { data: () => ({ i: 0 }) } },
        },
      };
      expect(evaluateSafeExpression('1.5', c, null, getRefValue)).toBe(1.5);
      expect(() => evaluateSafeExpression('[1]', c, null, getRefValue)).toThrow('Unexpected token');
    });

    it('classifyTwoWayString close without open', () => {
      expect(classifyTwoWayString('foo)]bar')).toBe('none');
    });

    it('valueNeedsInputResolve flow-only string', () => {
      expect(valueNeedsInputResolve('@if (true) { x }')).toBe(true);
    });

    it('output handler resolves array params', () => {
      const fn = vi.fn();
      const ctx = {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: { H: { go: fn } }, model: signal({ x: 1 }) },
      };
      const handler = createOutputHandler(
        { ref: 'H.go', params: [[{ nested: '{{ x }}' }, '{{ x }}']] },
        'click',
        ctx,
      );
      handler({});
      expect(fn).toHaveBeenCalled();
    });
  });

  describe('runBlockDirectiveEffect stale async paths', () => {
    it('ignores block reference rejection when run id is stale', async () => {
      const state = createInitialBlockDirectiveLoadState();
      const vcr = { clear: vi.fn() } as unknown as ViewContainerRef;
      const loadBlock = vi.fn();
      let rejectSlow!: (e: Error) => void;
      const slowDefs = {
        Slow: () =>
          new Promise<Record<string, unknown>>((_, reject) => {
            rejectSlow = reject;
          }),
      };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      runBlockDirectiveEffect(
        state,
        { viewContainerRef: vcr, loadBlock },
        { blockId: 'Slow' },
        slowDefs,
        null,
        null,
      );
      runBlockDirectiveEffect(state, { viewContainerRef: vcr, loadBlock }, null, null, null, null);
      rejectSlow(new Error('late'));
      await Promise.resolve();
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('ignores load rejection when generation is stale', async () => {
      const state = createInitialBlockDirectiveLoadState();
      const vcr = { clear: vi.fn() } as unknown as ViewContainerRef;
      let rejectFirst!: (e: Error) => void;
      const loadBlock = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectFirst = reject;
            }),
        )
        .mockResolvedValue({ destroy: vi.fn() } as never);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
        1,
      );
      await vi.waitFor(() => expect(loadBlock).toHaveBeenCalledTimes(2));
      rejectFirst(new Error('late'));
      await Promise.resolve();
      expect(consoleSpy).not.toHaveBeenCalledWith('Block load failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('RouteLoader optional route fields', () => {
    it('maps all guard types and route options', async () => {
      const router = { resetConfig: vi.fn() };
      await TestBed.configureTestingModule({
        providers: [
          RouteLoader,
          { provide: Router, useValue: router },
          { provide: HttpClient, useValue: { get: () => of({ routes: [] }) } },
        ],
      }).compileComponents();
      const comp = ComponentRegistry.getInstance();
      const guard = GuardRegistry.getInstance();
      comp.clear();
      guard.clear();
      @Component({ standalone: true, template: '' })
      class P {}
      comp.register('P', P);
      const g = (() => true) as never;
      Object.defineProperty(g, 'length', { value: 1 });
      guard.register('g', g);
      const rl = TestBed.inject(RouteLoader);
      await rl.loadRoutes({
        routes: [
          {
            path: 'full',
            component: 'P',
            title: 'T',
            outlet: 'aux',
            pathMatch: 'full',
            runGuardsAndResolvers: 'always',
            canActivate: ['g'],
            canDeactivate: ['g'],
            canLoad: ['g'],
            canMatch: ['g'],
            canActivateChild: ['g'],
            data: { k: 1 },
          },
        ],
      });
      const route = router.resetConfig.mock.calls[0][0][0];
      expect(route.title).toBe('T');
      expect(route.outlet).toBe('aux');
      expect(route.canActivate?.length).toBe(1);
      comp.clear();
      guard.clear();
    });
  });
});
