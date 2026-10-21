import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Component,
  Directive,
  ViewChild,
  ViewContainerRef,
  signal,
  model,
  Input,
  Injectable,
  WritableSignal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlockLoaderService } from '../../projects/blocks-studio/src/lib/core/block-loader/block-loader.service';
import { ComponentRegistry } from '../../projects/blocks-studio/src/lib/core/registry/component.registry';
import { DirectiveRegistry } from '../../projects/blocks-studio/src/lib/core/registry/directive.registry';
import { ServiceRegistry } from '../../projects/blocks-studio/src/lib/core/registry/service.registry';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';

@Component({ standalone: true, template: '<ng-container #anchor></ng-container>' })
class HostComponent {
  @ViewChild('anchor', { read: ViewContainerRef }) vcr!: ViewContainerRef;
}

@Component({ standalone: true, template: '' })
class TestBlockComponent {
  @Input() title = '';
  @Input() count = 0;
  @Input() registry: unknown = null;
}

@Directive({ selector: '[hostTooltip]', standalone: true })
class HostTooltipDirective {
  @Input() tooltip = '';
}

@Injectable()
class RootStateService {
  label = 'root';
}

@Injectable()
class SelfStateService {
  model = signal<string | undefined>(undefined);
  setModel = vi.fn();
}

describe('BlockLoaderService', () => {
  let loader: BlockLoaderService;
  let fixture: ComponentFixture<HostComponent>;
  let vcr: ViewContainerRef;
  let componentRegistry: ComponentRegistry;
  let directiveRegistry: DirectiveRegistry;
  let serviceRegistry: ServiceRegistry;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [BlockLoaderService],
    }).compileComponents();

    loader = TestBed.inject(BlockLoaderService);
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    vcr = fixture.componentInstance.vcr;

    componentRegistry = ComponentRegistry.getInstance();
    directiveRegistry = DirectiveRegistry.getInstance();
    serviceRegistry = ServiceRegistry.getInstance();
    componentRegistry.register('TestBlock', TestBlockComponent);
    directiveRegistry.register('HostTooltip', HostTooltipDirective);
    serviceRegistry.register('RootState', RootStateService);
    serviceRegistry.register('SelfState', SelfStateService);
  });

  afterEach(() => {
    if (componentRegistry?.has('TestBlock')) {
      componentRegistry.unregister('TestBlock');
    }
    if (directiveRegistry?.has('HostTooltip')) {
      directiveRegistry.unregister('HostTooltip');
    }
    if (serviceRegistry?.has('RootState')) {
      serviceRegistry.unregister('RootState');
    }
    if (serviceRegistry?.has('SelfState')) {
      serviceRegistry.unregister('SelfState');
    }
  });

  describe('load', () => {
    it('loads a minimal description and returns a ComponentRef', async () => {
      const model = signal(undefined);
      const result = await loader.load(
        { component: 'TestBlock' },
        vcr,
        model,
      );

      expect(result).toBeDefined();
      expect(result.instance).toBeInstanceOf(TestBlockComponent);
      expect(typeof result.destroy).toBe('function');
      result.destroy();
    });

    it('sets simple inputs on the component', async () => {
      const model = signal(undefined);
      const result = await loader.load(
        {
          component: 'TestBlock',
          inputs: { title: 'Hello', count: 42 },
        },
        vcr,
        model,
      );
      fixture.detectChanges();

      const comp = result.instance as TestBlockComponent;
      expect(comp.title).toBe('Hello');
      expect(comp.count).toBe(42);

      result.destroy();
    });

    it('throws when component is not registered', async () => {
      const model = signal(undefined);
      await expect(
        loader.load({ component: 'NonExistent' }, vcr, model),
      ).rejects.toThrow('Component "NonExistent" is not registered');
    });

    it('throws when block id is duplicate in same registry', async () => {
      const model = signal(undefined);
      const registry = new BlockRegistryImpl();
      await loader.load(
        { component: 'TestBlock', id: 'DupId' },
        vcr,
        model,
        { registry },
      );
      await expect(
        loader.load(
          { component: 'TestBlock', id: 'DupId' },
          vcr,
          model,
          { registry },
        ),
      ).rejects.toThrow('already registered');
    });

    it('applies host directive inputs from the block description', async () => {
      const model = signal(undefined);
      const result = await loader.load(
        {
          component: 'TestBlock',
          directives: ['HostTooltip'],
          inputs: { tooltip: 'Help text' },
        },
        vcr,
        model,
      );
      fixture.detectChanges();

      const tooltipDir = result.injector.get(HostTooltipDirective);
      expect(tooltipDir.tooltip).toBe('Help text');

      result.destroy();
    });

    it('applies initial inputs from description', async () => {
      const model = signal(undefined);
      const result = await loader.load(
        {
          component: 'TestBlock',
          id: 'Upd',
          inputs: { title: 'First', count: 5 },
        },
        vcr,
        model,
      );
      fixture.detectChanges();

      const comp = result.instance as TestBlockComponent;
      expect(comp.title).toBe('First');
      expect(comp.count).toBe(5);

      result.destroy();
    });
  });

  describe('block reference', () => {
    it('throws on invalid block description', async () => {
      await expect(
        loader.load({ component: 123 as unknown as string }, vcr, signal(undefined)),
      ).rejects.toThrow('Invalid block description');
    });

    it('resolves root and self scoped services', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const model = signal({ title: 'M' });
      const result = await loader.load(
        {
          component: 'TestBlock',
          services: [
            'RootState',
            { id: 'SelfState', scope: 'self', alias: 'model' },
            { id: 'MissingRoot', alias: 'model' },
          ],
        },
        vcr,
        model,
      );
      fixture.detectChanges();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('reserved'));
      result.destroy();
      warn.mockRestore();
    });

    it('resolves string model ref to signal', async () => {
      const outer = signal('outer');
      const registry = new BlockRegistryImpl();
      registry.register('Src', {
        instance: {
          services: { V: { text: outer } },
          model: signal({}),
        },
      });
      const model = signal('Src:V.text');
      const result = await loader.load(
        { component: 'TestBlock', id: 'Child' },
        vcr,
        model,
        { registry },
      );
      fixture.detectChanges();
      result.destroy();
    });

    it('loads without binding optional two-way inputs missing from description', async () => {
      @Component({ standalone: true, template: '' })
      class TwoWayOnly {
        value = model(0);
      }
      componentRegistry.register('TwoWayOnly', TwoWayOnly);
      try {
        const model = signal(undefined);
        const result = await loader.load({ component: 'TwoWayOnly' }, vcr, model);
        fixture.detectChanges();
        result.destroy();
      } finally {
        componentRegistry.unregister('TwoWayOnly');
      }
    });

    it('resolves object model with nested mustache', async () => {
      const model = signal({ title: '{{ ref("RootState.label") }}' } as unknown as Record<string, unknown>);
      const result = await loader.load({ component: 'TestBlock' }, vcr, model);
      fixture.detectChanges();
      result.destroy();
    });

    it('resolves block reference when blockDefinitions provided', async () => {
      const model = signal(undefined);
      const defs = {
        MyBlock: {
          component: 'TestBlock',
          id: 'MyBlock',
          inputs: { title: 'From Def' },
        },
      };

      const result = await loader.load(
        { blockId: 'MyBlock' } as { blockId: string },
        vcr,
        model,
        { blockDefinitions: defs },
      );
      fixture.detectChanges();

      const comp = result.instance as TestBlockComponent;
      expect(comp.title).toBe('From Def');
      result.destroy();
    });
  });
});
