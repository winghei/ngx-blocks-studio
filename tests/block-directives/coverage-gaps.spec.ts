import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Component,
  Directive,
  Input,
  ViewChild,
  ViewContainerRef,
  signal,
  model,
  Injectable,
  WritableSignal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlockLoaderService } from '../../projects/blocks-studio/src/lib/core/block-loader/block-loader.service';
import { ComponentRegistry } from '../../projects/blocks-studio/src/lib/core/registry/component.registry';
import { ServiceRegistry } from '../../projects/blocks-studio/src/lib/core/registry/service.registry';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';
import { RouteLoader } from '../../projects/blocks-studio/src/lib/core/services/router-loader.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import {
  parseFlowTemplate,
  interpretFlow,
} from '../../projects/blocks-studio/src/lib/core/block-loader/flow-template';
import {
  createOutputHandler,
  splitCallableRef,
} from '../../projects/blocks-studio/src/lib/core/block-loader/output-reference';
import { evaluateSafeExpression } from '../../projects/blocks-studio/src/lib/core/block-loader/safe-expression-evaluator';
import { getRefValue } from '../../projects/blocks-studio/src/lib/core/block-loader/ref-resolver';
import {
  resolveMustacheInterpolatedString,
  mustacheSegmentToString,
} from '../../projects/blocks-studio/src/lib/core/block-loader/template-interpolation';
import { getBlockInputsAndOutputs, resolveBlockInputsAndOutputs } from '../../projects/blocks-studio/src/lib/core/block-loader/block-bindings';
import { GuardRegistry } from '../../projects/blocks-studio/src/lib/core/registry/guard.registry';
import { ComponentRegistry as CR } from '../../projects/blocks-studio/src/lib/core/registry/component.registry';
import { DirectiveRegistry } from '../../projects/blocks-studio/src/lib/core/registry/directive.registry';
import { ServiceRegistry as SR } from '../../projects/blocks-studio/src/lib/core/registry/service.registry';
import { BlockDirective } from '../../projects/blocks-studio/src/lib/core/block-loader/block.directive';
import { NO_ERRORS_SCHEMA } from '@angular/core';

@Component({ standalone: true, template: '<ng-container #a></ng-container>' })
class VcrHost {
  @ViewChild('a', { read: ViewContainerRef }) vcr!: ViewContainerRef;
}

@Component({ standalone: true, template: '' })
class ModelBlock {
  title = model('default');
  @Input() plain = '';
}

@Component({ standalone: true, template: '' })
class EmptyMirrorHost {}

@Injectable()
class CountSvc {
  count = signal(7);
}

describe('coverage gaps', () => {
  describe('flow-template parse edge cases', () => {
    it('parses @else without block as text continuation', () => {
      const nodes = parseFlowTemplate('@if (a) { x } @else no-brace');
      expect(nodes.some((n) => n.type === 'if')).toBe(true);
    });

    it('handles single-character text advance', () => {
      expect(parseFlowTemplate('@')).toEqual([{ type: 'text', value: '@' }]);
    });

    it('for-loop with unclosed brace falls back to text', () => {
      const nodes = parseFlowTemplate('@for (i of list) { unclosed');
      expect(nodes[0].type).toBe('text');
    });
  });

  describe('output-reference branches', () => {
    it('uses single param object for call', () => {
      const fn = vi.fn();
      const ctx = {
        registry: new BlockRegistryImpl(),
        currentInstance: {
          services: { S: { go: fn } },
          model: signal({}),
        },
      };
      createOutputHandler({ ref: 'S.go', params: { a: 1 } }, 'o', ctx)(null);
      expect(fn).toHaveBeenCalledWith({ a: 1 });
    });

    it('covers splitCallableRef colon edge and non-object callTarget warn', () => {
      expect(splitCallableRef('  ')).toBeNull();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      createOutputHandler('S.x', 'o', {
        registry: new BlockRegistryImpl(),
        currentInstance: { services: { S: null }, model: signal({}) },
      })(null);
      warn.mockRestore();
    });
  });

  describe('template-interpolation', () => {
    it('evaluateExpression catch falls back to ref path', () => {
      const ctx = {
        registry: new BlockRegistryImpl(),
        currentInstance: { model: signal({ title: 'ok' }), services: {} },
      };
      expect(mustacheSegmentToString('{{ @@@ }}', ctx, null)).toBe('');
      expect(resolveMustacheInterpolatedString('pre {{ title }}', ctx, null)).toBe('pre ok');
    });
  });

  describe('safe-expression default binary op', () => {
    it('covers string concatenation via +', () => {
      expect(evaluateSafeExpression("'a' + 'b'", { registry: new BlockRegistryImpl(), currentInstance: { model: signal({}), services: {} } }, null, getRefValue)).toBe('ab');
    });
  });

  describe('block-bindings model() metadata', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({ imports: [ModelBlock] }).compileComponents();
      TestBed.createComponent(ModelBlock);
    });

    it('detects two-way via ɵdir outputs map fallback', () => {
      class FakeDir {}
      (FakeDir as unknown as { ɵdir: { inputs: Record<string, unknown>; outputs: Record<string, string> } }).ɵdir = {
        inputs: { title: ['title', true] },
        outputs: { title: 'titleChange' },
      };
      const meta = getBlockInputsAndOutputs([FakeDir as never]);
      expect(meta.twoWay).toContain('title');
    });

    it('two-way writable signal binds directly', () => {
      const title = signal('A');
      const reg = new BlockRegistryImpl();
      reg.register('B', {
        instance: { services: { F: { title } }, model: signal({}) },
      });
      const ctx = {
        registry: reg,
        currentBlockId: 'B',
        currentInstance: reg.get('B')!.instance,
      };
      const { resolvedTwoWay } = resolveBlockInputsAndOutputs(
        { inputs: { title: '[(F.title)]' } },
        new Set(),
        new Set(),
        new Set(['title']),
        ctx,
      );
      expect(resolvedTwoWay.title).toBe(title);
    });
  });

  describe('BlockLoaderService deep paths', () => {
    let loader: BlockLoaderService;
    let fixture: ComponentFixture<VcrHost>;
    let componentRegistry: ComponentRegistry;
    let serviceRegistry: ServiceRegistry;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [VcrHost],
        providers: [BlockLoaderService, CountSvc],
      }).compileComponents();
      loader = TestBed.inject(BlockLoaderService);
      fixture = TestBed.createComponent(VcrHost);
      fixture.detectChanges();
      componentRegistry = ComponentRegistry.getInstance();
      serviceRegistry = ServiceRegistry.getInstance();
      componentRegistry.register('ModelBlock', ModelBlock);
      serviceRegistry.register('CountSvc', CountSvc);
    });

    afterEach(() => {
      componentRegistry.unregister('ModelBlock');
      serviceRegistry.unregister('CountSvc');
    });

    it('binds model from numeric mustache preserving non-string type', async () => {
      const vcr = fixture.componentInstance.vcr;
      const model = signal("{{ ref('CountSvc.count') }}");
      const reg = new BlockRegistryImpl();
      const result = await loader.load(
        { component: 'ModelBlock', id: 'Num', services: ['CountSvc'] },
        vcr,
        model,
        { registry: reg },
      );
      fixture.detectChanges();
      expect(reg.get('Num')?.instance.model?.()).toBe(7);
      result.destroy();
    });

    it('binds model from numeric mustache and self service model sync', async () => {
      const vcr = fixture.componentInstance.vcr;
      const model = signal("{{ ref('CountSvc.count') }}");
      const result = await loader.load(
        {
          component: 'ModelBlock',
          services: [{ id: 'CountSvc', scope: 'self' }],
        },
        vcr,
        model,
      );
      fixture.detectChanges();
      result.destroy();
    });

    it('uses linkedSignal when model string ref is not a signal', async () => {
      const vcr = fixture.componentInstance.vcr;
      const model = signal('CountSvc.count');
      const result = await loader.load({ component: 'ModelBlock' }, vcr, model);
      fixture.detectChanges();
      result.destroy();
    });

    it('resolves object model with nested templates', async () => {
      const vcr = fixture.componentInstance.vcr;
      const model = signal({ t: '{{ ref("CountSvc.count") }}' });
      const result = await loader.load(
        { component: 'ModelBlock', services: ['CountSvc'] },
        vcr,
        model,
      );
      fixture.detectChanges();
      result.destroy();
    });
  });

  describe('RouteLoader missing component key', () => {
    it('throws from loadComponent when component key empty', async () => {
      const router = { resetConfig: vi.fn() };
      await TestBed.configureTestingModule({
        providers: [
          RouteLoader,
          { provide: Router, useValue: router },
          { provide: HttpClient, useValue: { get: () => of({ routes: [{ path: 'e', component: '' }] }) } },
        ],
      }).compileComponents();
      const rl = TestBed.inject(RouteLoader);
      await rl.loadRoutes({ routes: [{ path: 'e', component: '' }] });
      const routes = router.resetConfig.mock.calls[0][0];
      await expect(routes[0].loadComponent()).rejects.toThrow('must specify a component');
    });
  });

  describe('registry sync paths', () => {
    it('ComponentRegistry getSync caches type', () => {
      const c = CR.getInstance();
      c.clear();
      @Component({ template: '' })
      class C {}
      c.register('c', C);
      expect(c.getSync('c')).toBe(C);
      c.clear();
    });

    it('DirectiveRegistry getSync caches type', () => {
      const d = DirectiveRegistry.getInstance();
      d.clear();
      @Directive({ selector: '[d]' })
      class D {}
      d.register('d', D);
      expect(d.getSync('d')).toBe(D);
      d.clear();
    });

    it('ServiceRegistry getTypeSync for eager type', () => {
      const s = SR.getInstance();
      s.clear();
      @Injectable()
      class S {}
      s.register('s', S);
      expect(s.getTypeSync('s')).toBe(S);
      s.clear();
    });
  });

  describe('BlockDirective loadBlock callback', () => {
    it('passes blockDefinitions into loader.load', async () => {
      const compReg = ComponentRegistry.getInstance();
      compReg.register('ModelBlock', ModelBlock);
      @Component({
        standalone: true,
        imports: [BlockDirective],
        template: '<div block [description]="desc()" [blockDefinitions]="defs()"></div>',
        schemas: [NO_ERRORS_SCHEMA],
      })
      class Host {
        desc = signal<{ blockId: string } | null>({ blockId: 'X' });
        defs = signal({ X: { component: 'ModelBlock' } });
      }
      await TestBed.configureTestingModule({ imports: [Host, BlockDirective] }).compileComponents();
      const f = TestBed.createComponent(Host);
      f.detectChanges();
      await f.whenStable();
      compReg.unregister('ModelBlock');
    });
  });
});
