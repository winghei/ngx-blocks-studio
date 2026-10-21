import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ViewContainerRef,
  signal,
  model,
  Injectable,
  WritableSignal,
  Injector,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlockLoaderService } from '../../projects/blocks-studio/src/lib/core/block-loader/block-loader.service';
import { ComponentRegistry } from '../../projects/blocks-studio/src/lib/core/registry/component.registry';
import { ServiceRegistry } from '../../projects/blocks-studio/src/lib/core/registry/service.registry';
import { DirectiveRegistry } from '../../projects/blocks-studio/src/lib/core/registry/directive.registry';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';
import { BlockRegistryService } from '../../projects/blocks-studio/src/lib/core/services/block-registry.service';

@Component({ standalone: true, template: '<ng-container #h></ng-container>' })
class Host {
  @ViewChild('h', { read: ViewContainerRef }) vcr!: ViewContainerRef;
}

@Component({ standalone: true, template: '' })
class OutComp {
  @Input() title = '';
  @Output() saved = new EventEmitter<void>();
}

@Component({ standalone: true, template: '' })
class TwoWayComp {
  label = model('init');
}

@Injectable()
class SelfModelSvc {
  model = signal<unknown>(undefined);
  setModel = vi.fn();
}

describe('BlockLoaderService extended', () => {
  let loader: BlockLoaderService;
  let fixture: ComponentFixture<Host>;
  let vcr: ViewContainerRef;
  let componentRegistry: ComponentRegistry;
  let serviceRegistry: ServiceRegistry;
  let directiveRegistry: DirectiveRegistry;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [BlockLoaderService, SelfModelSvc],
    }).compileComponents();
    loader = TestBed.inject(BlockLoaderService);
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    vcr = fixture.componentInstance.vcr;
    componentRegistry = ComponentRegistry.getInstance();
    serviceRegistry = ServiceRegistry.getInstance();
    directiveRegistry = DirectiveRegistry.getInstance();
    componentRegistry.register('OutComp', OutComp);
    componentRegistry.register('TwoWayComp', TwoWayComp);
    serviceRegistry.register('SelfModelSvc', SelfModelSvc);
  });

  afterEach(() => {
    componentRegistry.unregister('OutComp');
    componentRegistry.unregister('TwoWayComp');
    serviceRegistry.unregister('SelfModelSvc');
    directiveRegistry.clear();
  });

  it('syncs self service model when block model is set', async () => {
    const model = signal({ id: 1 });
    const result = await loader.load(
      {
        component: 'OutComp',
        services: [{ id: 'SelfModelSvc', scope: 'self' }],
      },
      vcr,
      model,
    );
    fixture.detectChanges();
    result.injector.get(SelfModelSvc);
    result.destroy();
  });

  it('skips unknown directive id and omits output bindings not in description', async () => {
    const result = await loader.load(
      {
        component: 'OutComp',
        directives: ['MissingDirective'],
      },
      vcr,
      signal(undefined),
    );
    fixture.detectChanges();
    result.destroy();
  });

  it('warns when self-scoped service uses reserved alias', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loader.load(
      {
        component: 'OutComp',
        services: [{ id: 'SelfModelSvc', scope: 'self', alias: 'services' }],
      },
      vcr,
      signal(undefined),
    );
    fixture.detectChanges();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('reserved'));
    result.destroy();
    warn.mockRestore();
  });

  it('skips assigning self service when injector returns null', async () => {
    @Injectable()
    class UnprovidedSelfSvc {}
    serviceRegistry.register('UnprovidedSelfSvc', UnprovidedSelfSvc);
    try {
      const result = await loader.load(
        {
          component: 'OutComp',
          services: [{ id: 'UnprovidedSelfSvc', scope: 'self' }],
        },
        vcr,
        signal(undefined),
      );
      fixture.detectChanges();
      result.destroy();
    } finally {
      serviceRegistry.unregister('UnprovidedSelfSvc');
    }
  });

  it('uses service id as alias for root object service entries without alias', async () => {
    const result = await loader.load(
      { component: 'OutComp', services: [{ id: 'SelfModelSvc' }] },
      vcr,
      signal(undefined),
    );
    fixture.detectChanges();
    result.destroy();
  });

  it('skips self service assignment when child injector get returns null', async () => {
    serviceRegistry.register('NullSelfSvc', SelfModelSvc);
    const origCreate = Injector.create.bind(Injector);
    const createSpy = vi.spyOn(Injector, 'create').mockImplementation((opts) => {
      const inj = origCreate(opts);
      vi.spyOn(inj, 'get').mockReturnValue(null as never);
      return inj;
    });
    try {
      const result = await loader.load(
        {
          component: 'OutComp',
          services: [{ id: 'NullSelfSvc', scope: 'self' }],
        },
        vcr,
        signal(undefined),
      );
      fixture.detectChanges();
      result.destroy();
    } finally {
      createSpy.mockRestore();
      serviceRegistry.unregister('NullSelfSvc');
    }
  });

  it('continues when self service type is unknown', async () => {
    const result = await loader.load(
      {
        component: 'OutComp',
        services: [{ id: 'NotRegisteredSvc', scope: 'self' }],
      },
      vcr,
      signal(undefined),
    );
    fixture.detectChanges();
    result.destroy();
  });

  it('falls back to self scope when root service is missing from injector', async () => {
    serviceRegistry.register('OrphanSvc', SelfModelSvc);
    try {
      const result = await loader.load(
        { component: 'OutComp', services: ['OrphanSvc'] },
        vcr,
        signal({ a: 1 }),
      );
      fixture.detectChanges();
      result.destroy();
    } finally {
      serviceRegistry.unregister('OrphanSvc');
    }
  });

  it('resolves object model with nested mustache via linkedSignal', async () => {
    const result = await loader.load(
      { component: 'OutComp' },
      vcr,
      signal({ label: 'static', nested: { title: '{{ label }}' } }),
    );
    fixture.detectChanges();
    result.destroy();
  });

  it('falls back when string model does not resolve to a ref signal', async () => {
    const result = await loader.load({ component: 'OutComp' }, vcr, signal('MissingSvc.field'));
    fixture.detectChanges();
    result.destroy();
  });

  it('creates two-way bindings when description uses [(ref)]', async () => {
    const label = signal('bound');
    const registry = new BlockRegistryImpl();
    registry.register('Src', {
      instance: { services: { L: { label } }, model: signal({}) },
    });
    const result = await loader.load(
      {
        component: 'TwoWayComp',
        inputs: { label: '[(Src:L.label)]' },
      },
      vcr,
      signal(undefined),
      { registry },
    );
    fixture.detectChanges();
    fixture.detectChanges();
    expect(result.instance).toBeInstanceOf(TwoWayComp);
    result.destroy();
  });

  it('resolves scoped refs via BlockRegistryService during load', async () => {
    const scoped = new BlockRegistryImpl();
    scoped.register('Cell', {
      instance: { services: {}, model: signal({ v: 'scoped' }) },
    });
    TestBed.inject(BlockRegistryService).setScopedRegistry('col', scoped);
    const result = await loader.load(
      {
        component: 'OutComp',
        inputs: { title: "{{ ref('col/Cell:model.v') }}" },
      },
      vcr,
      signal(undefined),
    );
    fixture.detectChanges();
    result.destroy();
  });

  it('uses linkedSignal for whitespace-only model ref string', async () => {
    const result = await loader.load({ component: 'OutComp' }, vcr, signal('   '));
    fixture.detectChanges();
    result.destroy();
  });

  it('resolves block model object with nested mustache', async () => {
    const registry = new BlockRegistryImpl();
    registry.register('Src', {
      instance: { services: { S: { title: signal('T') } }, model: signal({}) },
    });
    const result = await loader.load(
      {
        component: 'OutComp',
        inputs: { title: 'x' },
      },
      vcr,
      signal({ label: "{{ ref('Src:S.title') }}" }),
      { registry },
    );
    fixture.detectChanges();
    result.destroy();
  });
});
