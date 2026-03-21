import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, ViewChild, ViewContainerRef, signal, Input } from '@angular/core';
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

describe('BlockLoaderService', () => {
  let loader: BlockLoaderService;
  let fixture: ComponentFixture<HostComponent>;
  let vcr: ViewContainerRef;
  let componentRegistry: ComponentRegistry;
  let directiveRegistry: DirectiveRegistry;

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
    componentRegistry.register('TestBlock', TestBlockComponent);
  });

  afterEach(() => {
    if (componentRegistry?.has('TestBlock')) {
      componentRegistry.unregister('TestBlock');
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
