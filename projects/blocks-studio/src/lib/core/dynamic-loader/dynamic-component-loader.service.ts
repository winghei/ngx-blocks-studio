import {
  Type,
  Injector,
  Injectable,
  inject,
  runInInjectionContext,
  ComponentRef,
  ViewContainerRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  DynamicComponentDescriptor,
  safeParseDynamicComponentDescriptor,
} from './dynamic-component-descriptor';
import {
  type DynamicBlockRegistry,
  DynamicBlockRegistryImpl,
  type BlockInstanceHandle,
} from './dynamic-block-registry';
import { buildBlockData } from './model-parser';
import { ComponentRegistry } from '../registry/component.registry';
import { ServiceRegistry } from '../registry/service.registry';

export interface DynamicComponentLoadOptions {
  /** Handlers for component outputs; keys must match descriptor.output names. */
  outputs?: Record<string, (value: unknown) => void>;
  /** Registry for block instances by id; shared across tree so refs (e.g. {{RegistrationForm.firstName}}) resolve. If not provided, a transient registry is used for this load only. */
  registry?: DynamicBlockRegistry;
}

export interface DynamicComponentLoadResult {
  componentRef: ComponentRef<unknown>;
  destroy: () => void;
  /** Update the loaded component's inputs from a new descriptor (same component/services). */
  updateInputs: (descriptor: unknown) => void;
}

@Injectable({
  providedIn: 'root',
})
export class DynamicComponentLoaderService {
  private readonly injector = inject(Injector);
  private readonly componentRegistry = ComponentRegistry.getInstance();
  private readonly serviceRegistry = ServiceRegistry.getInstance();

  /**
   * Load a dynamic component from a JSON-only descriptor.
   * Validates the descriptor, resolves component and "self" services from registries,
   * creates the component in the given ViewContainerRef with a child injector for
   * self-scoped services, sets inputs, and optionally wires outputs.
   */
  async load(
    descriptor: unknown,
    viewContainerRef: ViewContainerRef,
    options?: DynamicComponentLoadOptions
  ): Promise<DynamicComponentLoadResult> {
    const parsed = safeParseDynamicComponentDescriptor(descriptor);
    if (!parsed.success) {
      throw new Error(
        `Invalid dynamic component descriptor: ${parsed.error.message}`
      );
    }
    const desc = parsed.data;

    const registry = options?.registry ?? new DynamicBlockRegistryImpl();
    if (desc.id != null && desc.id !== '') {
      if (registry.has(desc.id)) {
        throw new Error(
          `Block id "${desc.id}" is already registered. Each id may only occur once per tree.`
        );
      }
    }

    const componentType = await this.componentRegistry.get(desc.component);
    if (!componentType) {
      throw new Error(
        `Component "${desc.component}" is not registered. Register it with ComponentRegistry.`
      );
    }

    const childInjector = await this.buildChildInjector(desc);
    const componentRef = viewContainerRef.createComponent(componentType as Type<unknown>, {
      injector: childInjector,
    });

    const instance = componentRef.instance as Record<string, unknown>;
    let blockEffectCleanups: Array<() => void> = [];

    runInInjectionContext(componentRef.injector, () => {
      const result = buildBlockData(desc.model, {
        getBlock: (id) => registry.get(id),
      });
      instance['blockData'] = result.blockData;
      blockEffectCleanups = result.blockEffectCleanups;
    });

    if (desc.id != null && desc.id !== '') {
      const handle: BlockInstanceHandle = {
        blockData: instance['blockData'] as BlockInstanceHandle['blockData'],
      };
      registry.register(desc.id, handle);
    }

    this.setInputs(componentRef, desc);
    const subscriptions = this.wireOutputs(componentRef, desc, options?.outputs);

    const blockId = desc.id;

    const destroy = (): void => {
      blockEffectCleanups.forEach((fn) => fn());
      if (blockId != null && blockId !== '') {
        registry.unregister(blockId);
      }
      subscriptions.forEach((sub) => sub.unsubscribe());
      const index = viewContainerRef.indexOf(componentRef.hostView);
      if (index !== -1) {
        viewContainerRef.remove(index);
      }
      componentRef.destroy();
    };

    const updateInputs = (newDescriptor: unknown): void => {
      const parsed = safeParseDynamicComponentDescriptor(newDescriptor);
      if (!parsed.success) {
        console.warn('updateInputs: invalid descriptor', parsed.error.message);
        return;
      }
      this.setInputs(componentRef, parsed.data);
    };

    return { componentRef, destroy, updateInputs };
  }

  private async buildChildInjector(
    desc: DynamicComponentDescriptor
  ): Promise<Injector> {
    const selfEntries = desc.services.filter(
      (s): s is { context: 'self'; key: string } =>
        typeof s === 'object' && s.context === 'self'
    );
    if (selfEntries.length === 0) {
      return this.injector;
    }

    const providers: Array<{ provide: Type<unknown>; useClass: Type<unknown> }> = [];
    for (const entry of selfEntries) {
      const serviceType = await this.serviceRegistry.getType(entry.key);
      if (serviceType) {
        providers.push({
          provide: serviceType as Type<unknown>,
          useClass: serviceType as Type<unknown>,
        });
      }
    }

    if (providers.length === 0) {
      return this.injector;
    }

    return Injector.create({
      providers,
      parent: this.injector,
    });
  }

  private setInputs(
    componentRef: ComponentRef<unknown>,
    desc: DynamicComponentDescriptor
  ): void {
    const inst = componentRef.instance as Record<string, unknown>;
    if (desc.input != null && Object.keys(desc.input).length > 0) {
      if (componentRef.setInput) {
        componentRef.setInput('input', desc.input);
      } else {
        inst['input'] = desc.input;
      }
    }
    if (desc.model !== undefined) {
      if (componentRef.setInput) {
        componentRef.setInput('model', desc.model);
      } else {
        inst['model'] = desc.model;
      }
    }
  }

  private wireOutputs(
    componentRef: ComponentRef<unknown>,
    desc: DynamicComponentDescriptor,
    outputHandlers?: Record<string, (value: unknown) => void>
  ): Subscription[] {
    const subscriptions: Subscription[] = [];
    const outputNames = desc.output ?? [];
    if (!outputHandlers || outputNames.length === 0) {
      return subscriptions;
    }

    const instance = componentRef.instance as Record<string, unknown>;
    for (const name of outputNames) {
      const handler = outputHandlers[name];
      const emitter = instance[name];
      if (handler && emitter && typeof (emitter as { subscribe?: unknown }).subscribe === 'function') {
        const sub = (emitter as { subscribe: (fn: (v: unknown) => void) => Subscription }).subscribe(
          (value: unknown) => handler(value)
        );
        subscriptions.push(sub);
      }
    }
    return subscriptions;
  }
}
