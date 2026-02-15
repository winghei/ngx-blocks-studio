import {
  Type,
  Injector,
  Injectable,
  inject,
  ComponentRef,
  ViewContainerRef,
  effect,
  type EffectRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  BlockDescription,
  safeParseBlockDescription,
  normalizeServices,
} from './block-description.schema';
import { BlockRegistryImpl, type BlockRegistry, type BlockInstanceHandle } from './block-registry';
import { ResolverContext, getRefValue, setRefValue } from './ref-resolver';
import { isInvalidTwoWayMix, isTwoWayRefString, parseTwoWayRef } from './ref-expressions';
import { createOutputHandler } from './output-reference';
import { ComponentRegistry } from '../registry/component.registry';
import { ServiceRegistry } from '../registry/service.registry';

export interface BlockLoadOptions {
  outputHandlers?: Record<string, (value: unknown) => void>;
  registry?: BlockRegistry;
}

export interface BlockLoadResult {
  componentRef: ComponentRef<unknown>;
  destroy: () => void;
  updateInputs: (description: unknown) => void;
}

@Injectable({ providedIn: 'root' })
export class BlockLoaderService {
  private readonly injector = inject(Injector);
  private readonly componentRegistry = ComponentRegistry.getInstance();
  private readonly serviceRegistry = ServiceRegistry.getInstance();

  async load(
    description: unknown,
    viewContainerRef: ViewContainerRef,
    options?: BlockLoadOptions
  ): Promise<BlockLoadResult> {
    const parsed = safeParseBlockDescription(description);
    if (!parsed.success) {
      throw new Error(`Invalid block description: ${parsed.error.message}`);
    }
    const desc = parsed.data;
    const registry = options?.registry ?? new BlockRegistryImpl();
    if (desc.id != null && desc.id !== '' && registry.has(desc.id)) {
      throw new Error(`Block id "${desc.id}" is already registered.`);
    }

    const componentType = await this.componentRegistry.get(desc.component);
    if (!componentType) {
      throw new Error(`Component "${desc.component}" is not registered.`);
    }

    const services = normalizeServices(desc.services);
    const childInjector = await this.buildChildInjector(services);
    const componentRef = viewContainerRef.createComponent(componentType as Type<unknown>, {
      injector: childInjector,
    });

    const blockInstance: Record<string, unknown> = {};
    const selfServices = services.filter((s): s is { id: string; scope: 'self' } => typeof s === 'object' && (s as { scope?: string }).scope === 'self');
    for (const entry of selfServices) {
      const id = entry.id;
      const serviceType = await this.serviceRegistry.getType(id);
      if (serviceType) {
        const svc = componentRef.injector.get(serviceType as Type<unknown>);
        if (svc != null) blockInstance[id] = svc;
      }
    }
    if (desc.inputs?.['model'] != null) {
      const model = desc.inputs['model'];
      for (const svc of Object.values(blockInstance)) {
        if (svc != null && typeof (svc as Record<string, unknown>)['setModel'] === 'function') {
          ((svc as Record<string, unknown>)['setModel'] as (v: unknown) => void)(model);
        }
      }
    }

    const ctx: ResolverContext = { registry, currentBlockId: desc.id ?? undefined, currentInstance: blockInstance };
    const handle: BlockInstanceHandle = { instance: blockInstance };
    if (desc.id != null && desc.id !== '') registry.register(desc.id, handle);
    const effectRefs = this.setInputs(componentRef, desc, ctx);
    const subscriptions = this.wireOutputs(componentRef, desc, registry, options?.outputHandlers);

    const doDestroy = (): void => {
      if (desc.id != null && desc.id !== '') registry.unregister(desc.id);
      effectRefs.forEach((ref) => ref.destroy());
      subscriptions.forEach((s) => s.unsubscribe());
      const idx = viewContainerRef.indexOf(componentRef.hostView);
      if (idx !== -1) viewContainerRef.remove(idx);
      componentRef.destroy();
    };
    handle.destroy = doDestroy;

    const updateInputs = (newDesc: unknown): void => {
      const p = safeParseBlockDescription(newDesc);
      if (p.success) this.setInputs(componentRef, p.data, ctx);
    };

    return { componentRef, destroy: doDestroy, updateInputs };
  }

  private async buildChildInjector(services: ReturnType<typeof normalizeServices>): Promise<Injector> {
    const selfServices = services.filter((s): s is { id: string; scope: 'self' } => typeof s === 'object' && (s as { scope?: string }).scope === 'self');
    if (selfServices.length === 0) return this.injector;
    const providers: { provide: Type<unknown>; useClass: Type<unknown> }[] = [];
    for (const entry of selfServices) {
      const id = (entry as { id: string }).id;
      const serviceType = await this.serviceRegistry.getType(id);
      if (serviceType) {
        providers.push({ provide: serviceType as Type<unknown>, useClass: serviceType as Type<unknown> });
      }
    }
    return providers.length === 0 ? this.injector : Injector.create({ providers, parent: this.injector });
  }

  /** Set inputs and wire template/two-way effects. Single pass over inputs for large configs. */
  private setInputs(
    componentRef: ComponentRef<unknown>,
    desc: BlockDescription,
    ctx: ResolverContext
  ): EffectRef[] {
    const effectRefs: EffectRef[] = [];
    const inputs = desc.inputs ?? {};
    const inst = componentRef.instance as Record<string, unknown>;
    for (const [key, value] of Object.entries(inputs)) {
      if (key === 'model') continue;
      if (typeof value === 'string' && isInvalidTwoWayMix(value)) {
        throw new Error(
          `Invalid input "${String(key)}": two-way ref "[( )]" cannot be mixed with literals or "{{ }}". ` +
            `Use exactly "[(refPath)]" for two-way or "{{ refPath }}" for read-only.`
        );
      }
      const str = value as string;
      if (typeof value === 'string' && str.indexOf('{{') !== -1 && str.indexOf('}}') !== -1) {
        const initial = this.interpolateTemplate(str, ctx);
        if (componentRef.setInput) componentRef.setInput(key as never, initial as never);
        else inst[key] = initial;
        effectRefs.push(
          effect(
            () => {
              const resolved = this.interpolateTemplate(str, ctx);
              if (componentRef.setInput) componentRef.setInput(key as never, resolved as never);
              else inst[key] = resolved;
            },
            { injector: this.injector }
          )
        );
        continue;
      }
      if (typeof value === 'string' && isTwoWayRefString(value)) {
        const refPath = parseTwoWayRef(value);
        if (refPath) {
          const initial = getRefValue(refPath, ctx);
          if (componentRef.setInput) componentRef.setInput(key as never, initial as never);
          else inst[key] = initial;
          const modelSig = inst[key];
          if (modelSig != null && typeof modelSig === 'function') {
            effectRefs.push(
              effect(
                () => {
                  const fromRef = getRefValue(refPath, ctx);
                  if (fromRef === undefined) return;
                  if (componentRef.setInput) {
                    componentRef.setInput(key as never, fromRef as never);
                    componentRef.changeDetectorRef.detectChanges();
                  }
                },
                { injector: this.injector }
              )
            );
            effectRefs.push(
              effect(
                () => {
                  const current = (modelSig as () => unknown)();
                  setRefValue(refPath, ctx, current);
                },
                { injector: this.injector }
              )
            );
          }
        }
        continue;
      }
      const resolved = this.resolveInputValue(value, ctx);
      if (componentRef.setInput) componentRef.setInput(key as never, resolved as never);
      else inst[key] = resolved;
    }
    return effectRefs;
  }

  /** Replace all {{ refPath }} in a string with resolved values (indexOf-based, no regex). */
  private interpolateTemplate(template: string, ctx: ResolverContext): string {
    let s = template;
    for (let i = 0; i < 20; i++) {
      const start = s.indexOf('{{');
      if (start === -1) return s;
      const end = s.indexOf('}}', start);
      if (end === -1) return s;
      const ref = s.slice(start + 2, end).trim();
      const val = ref ? getRefValue(ref, ctx) : null;
      const replacement = val != null ? String(val) : '';
      s = s.slice(0, start) + replacement + s.slice(end + 2);
    }
    return s;
  }

  /**
   * Resolve a single input value: resolve two-way refs, recurse into arrays/objects.
   * Strings with {{ }} are left as-is so child blocks receive the template for reactive interpolation.
   * Two-way refs inside nested block descriptors (object with "component" + "inputs") are left as-is
   * so that when a child block is loaded it still sees value: '[(ref)]' and can wire two-way binding.
   */
  private resolveInputValue(
    value: unknown,
    ctx: ResolverContext,
    options?: { preserveTwoWayRefs?: boolean }
  ): unknown {
    const preserveTwoWayRefs = options?.preserveTwoWayRefs ?? false;
    if (typeof value === 'string') {
      if (isInvalidTwoWayMix(value)) {
        throw new Error(
          `Invalid input: two-way ref "[( )]" cannot be mixed with literals or "{{ }}". ` +
            `Use exactly "[(refPath)]" for two-way or "{{ refPath }}" for read-only. Got: ${JSON.stringify(value)}`
        );
      }
      if (isTwoWayRefString(value)) {
        if (preserveTwoWayRefs) return value;
        const refPath = parseTwoWayRef(value);
        return refPath ? getRefValue(refPath, ctx) : value;
      }
      return value;
    }
    if (Array.isArray(value)) {
      let changed = false;
      const resolved = value.map((item) => {
        const r = this.resolveInputValue(item, ctx, options);
        if (r !== item) changed = true;
        return r;
      });
      return changed ? resolved : value;
    }
    if (value != null && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const isNestedBlockDescriptor =
        typeof obj['component'] === 'string' && obj['inputs'] != null;
      let changed = false;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const childOptions =
          isNestedBlockDescriptor && k === 'inputs'
            ? { preserveTwoWayRefs: true }
            : options;
        const resolved = this.resolveInputValue(v, ctx, childOptions);
        if (resolved !== v) changed = true;
        out[k] = resolved;
      }
      return changed ? out : value;
    }
    return value;
  }

  private wireOutputs(
    componentRef: ComponentRef<unknown>,
    desc: BlockDescription,
    registry: BlockRegistry,
    outputHandlers?: Record<string, (value: unknown) => void>
  ): Subscription[] {
    const subs: Subscription[] = [];
    const outputs = desc.outputs ?? {};
    const inst = componentRef.instance as Record<string, unknown>;
    for (const [outputKey, outputValue] of Object.entries(outputs)) {
      const handler = createOutputHandler(outputValue, outputKey, registry, outputHandlers);
      const emitter = inst[outputKey];
      if (emitter != null && typeof (emitter as { subscribe?: (fn: (v: unknown) => void) => { unsubscribe: () => void } }).subscribe === 'function') {
        const sub = (emitter as { subscribe: (fn: (v: unknown) => void) => { unsubscribe: () => void } }).subscribe((v: unknown) => handler(v));
        subs.push(sub as unknown as Subscription);
      }
    }
    return subs;
  }
}
