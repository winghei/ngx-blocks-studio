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
import { classifyTwoWayString, parseTwoWayRef } from './ref-expressions';
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
    const selfServices = services.filter((s): s is { id: string; scope: 'self' } => typeof s === 'object' && (s as { scope?: string }).scope === 'self');
    const serviceTypes = await this.getServiceTypes(selfServices);
    const childInjector = this.buildChildInjectorFromTypes(serviceTypes);
    const componentRef = viewContainerRef.createComponent(componentType as Type<unknown>, {
      injector: childInjector,
    });

    const blockInstance: Record<string, unknown> = {};
    for (let i = 0; i < selfServices.length; i++) {
      const id = selfServices[i].id;
      const serviceType = serviceTypes[i];
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
    let currentEffectRefs = this.setInputs(componentRef, desc, ctx);
    const subscriptions = this.wireOutputs(componentRef, desc, registry, options?.outputHandlers);

    const doDestroy = (): void => {
      if (desc.id != null && desc.id !== '') registry.unregister(desc.id);
      currentEffectRefs.forEach((ref) => ref.destroy());
      subscriptions.forEach((s) => s.unsubscribe());
      const idx = viewContainerRef.indexOf(componentRef.hostView);
      if (idx !== -1) viewContainerRef.remove(idx);
      componentRef.destroy();
    };
    handle.destroy = doDestroy;

    const updateInputs = (newDesc: unknown): void => {
      const p = safeParseBlockDescription(newDesc);
      if (p.success) {
        currentEffectRefs.forEach((ref) => ref.destroy());
        currentEffectRefs = this.setInputs(componentRef, p.data, ctx);
      }
    };

    return { componentRef, destroy: doDestroy, updateInputs };
  }

  /** Resolve all service types in parallel (single batch for load). */
  private async getServiceTypes(selfServices: { id: string; scope: 'self' }[]): Promise<(Type<unknown> | undefined)[]> {
    if (selfServices.length === 0) return [];
    return Promise.all(selfServices.map((e) => this.serviceRegistry.getType(e.id)));
  }

  private buildChildInjectorFromTypes(serviceTypes: (Type<unknown> | undefined)[]): Injector {
    const providers = serviceTypes.filter((t): t is Type<unknown> => t != null).map((t) => ({ provide: t, useClass: t }));
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
      if (typeof value === 'string') {
        const twoWayKind = classifyTwoWayString(value);
        if (twoWayKind === 'invalid-mix') {
          throw new Error(
            `Invalid input "${String(key)}": two-way ref "[( )]" cannot be mixed with literals or "{{ }}". ` +
              `Use exactly "[(refPath)]" for two-way or "{{ refPath }}" for read-only.`
          );
        }
        if (twoWayKind === 'two-way') {
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
      }
      const str = value as string;
      if (typeof value === 'string' && str.indexOf('{{') !== -1 && str.indexOf('}}', str.indexOf('{{')) !== -1) {
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
      const resolved = this.resolveInputValue(value, ctx);
      if (componentRef.setInput) componentRef.setInput(key as never, resolved as never);
      else inst[key] = resolved;
    }
    return effectRefs;
  }

  /** Replace all {{ refPath }} with resolved values. Uses parts array + join to avoid N string concats. */
  private static readonly INTERPOLATE_MAX_PLACEHOLDERS = 200;
  private interpolateTemplate(template: string, ctx: ResolverContext): string {
    const parts: string[] = [];
    let s = template;
    for (let i = 0; i < BlockLoaderService.INTERPOLATE_MAX_PLACEHOLDERS; i++) {
      const start = s.indexOf('{{');
      if (start === -1) {
        parts.push(s);
        break;
      }
      parts.push(s.slice(0, start));
      const end = s.indexOf('}}', start);
      if (end === -1) {
        parts.push(s.slice(start));
        break;
      }
      const ref = s.slice(start + 2, end).trim();
      const val = ref ? getRefValue(ref, ctx) : null;
      parts.push(val != null ? String(val) : '');
      s = s.slice(end + 2);
    }
    return parts.join('');
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
      const twoWayKind = classifyTwoWayString(value);
      if (twoWayKind === 'invalid-mix') {
        const preview = value.length > 200 ? `${value.slice(0, 200)}...` : value;
        throw new Error(
          `Invalid input: two-way ref "[( )]" cannot be mixed with literals or "{{ }}". ` +
            `Use exactly "[(refPath)]" for two-way or "{{ refPath }}" for read-only. Got: ${JSON.stringify(preview)}`
        );
      }
      if (twoWayKind === 'two-way') {
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
      const entries = Object.entries(value as Record<string, unknown>);
      const resolvedPairs: [string, unknown][] = [];
      let changed = false;
      for (const [k, v] of entries) {
        const childOptions =
          isNestedBlockDescriptor && k === 'inputs'
            ? { preserveTwoWayRefs: true }
            : options;
        const resolved = this.resolveInputValue(v, ctx, childOptions);
        if (resolved !== v) changed = true;
        resolvedPairs.push([k, resolved]);
      }
      if (!changed) return value;
      const out: Record<string, unknown> = {};
      for (const [k, r] of resolvedPairs) out[k] = r;
      return out;
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
