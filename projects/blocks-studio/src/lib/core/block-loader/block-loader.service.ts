import {
  ComponentRef,
  Injectable,
  Injector,
  Type,
  ViewContainerRef,
  effect,
  inject,
  isSignal,
  isWritableSignal,
  type EffectRef,
  type Signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ComponentRegistry } from '../registry/component.registry';
import { DirectiveRegistry } from '../registry/directive.registry';
import { ServiceRegistry } from '../registry/service.registry';
import {
  BlockDescription,
  type BlockInput,
  type BlockReference,
  isBlockReference,
  normalizeDirectives,
  normalizeServices,
  resolveBlockReference,
  safeParseBlockDescription,
  type ServiceEntry,
} from './block-description.schema';
import { BlockRegistryImpl, CurrentInstance, type BlockInstanceHandle, type BlockRegistry } from './block-registry';
import { createOutputHandler } from './output-reference';
import { classifyTwoWayString, parseTwoWayRef } from './ref-expressions';
import {
  ResolverContext,
  getRefSignal,
  getRefValue,
  getValueByPath,
  resolveRefPath,
  setRefValue,
} from './ref-resolver';

/** Target for setting an input or wiring an output: component or a host directive instance. */
export type InputOutputTarget =
  | { type: 'component'; componentRef: ComponentRef<unknown> }
  | { type: 'directive'; instance: Record<string, unknown> };

export interface BlockLoadOptions {
  outputHandlers?: Record<string, (value: unknown) => void>;
  registry?: BlockRegistry;
  /** Map of block id → full description; used when description is an id-only reference. */
  blockDefinitions?: Record<string, unknown>;
}

export interface BlockLoadResult {
  componentRef: ComponentRef<unknown>;
  destroy: () => void;
  updateInputs: (description: BlockInput | BlockReference) => void;
}

@Injectable({ providedIn: 'root' })
export class BlockLoaderService {
  private readonly injector = inject(Injector);
  private readonly componentRegistry = ComponentRegistry.getInstance();
  private readonly directiveRegistry = DirectiveRegistry.getInstance();
  private readonly serviceRegistry = ServiceRegistry.getInstance();

  async load(
    description: BlockInput | BlockReference,
    viewContainerRef: ViewContainerRef,
    model: Signal<unknown | undefined>,
    options?: BlockLoadOptions,
  ): Promise<BlockLoadResult> {
    let resolved: unknown = description;
    if (isBlockReference(description)) {
      resolved = resolveBlockReference(description, options?.blockDefinitions);
    }
    const parsed = safeParseBlockDescription(resolved);

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
    const selfServices = services.filter(
      (s): s is { id: string; scope: 'self'; alias?: string } =>
        typeof s === 'object' && (s as { scope?: string }).scope === 'self',
    );
    /** Root = string id or object with scope undefined/not 'self' (e.g. [{ id: 'State' }]). */
    const rootEntries = services
      .filter(
        (s): s is Exclude<ServiceEntry, { scope: 'self' }> =>
          typeof s === 'string' || (typeof s === 'object' && s.scope !== 'self'),
      )
      .map((s): { id: string; alias: string } =>
        typeof s === 'string' ? { id: s, alias: s } : { id: s.id, alias: s.alias ?? s.id },
      );
    const selfServiceTypes = await this.getServiceTypes(selfServices);
    const rootServiceTypes = await this.getServiceTypes(rootEntries);
    const directiveIds = normalizeDirectives(desc.directives);
    const directiveTypes = await this.getDirectiveTypes(directiveIds);
    // Use the view container's injector as parent so the created component participates in the
    // same injector hierarchy (e.g. RouteBlockComponent), giving RouterOutlet access to ActivatedRoute.
    const parentInjector = viewContainerRef.injector;
    const childInjector = this.buildChildInjectorFromTypes(selfServiceTypes, parentInjector);
    const componentRef = viewContainerRef.createComponent(componentType as Type<unknown>, {
      injector: childInjector,
      directives: directiveTypes.filter((d): d is Type<unknown> => d != null),
    });

    const directiveInstances = this.getDirectiveInstances(
      componentRef,
      directiveTypes.filter((d): d is Type<unknown> => d != null),
    );

    const blockInstance: CurrentInstance = {};
    for (let i = 0; i < selfServices.length; i++) {
      const alias = selfServices[i].alias ?? selfServices[i].id;
      const serviceType = selfServiceTypes[i];
      if (serviceType) {
        const svc = componentRef.injector.get(serviceType as Type<unknown>);
        if (svc != null) blockInstance[alias] = svc;
      }
    }
    for (let i = 0; i < rootEntries.length; i++) {
      const alias = rootEntries[i].alias;
      const serviceType = rootServiceTypes[i];
      if (serviceType) {
        const svc = this.injector.get(serviceType as Type<unknown>);
        if (svc != null) blockInstance[alias] = svc;
      }
    }
    const ctx: ResolverContext = {
      registry,
      currentBlockId: desc.id ?? undefined,
      currentInstance: blockInstance,
    };
    const handle: BlockInstanceHandle = { instance: blockInstance };
    if (desc.id != null && desc.id !== '') registry.register(desc.id, handle);

    this.applyInitialModel(ctx, blockInstance, model);
    let currentEffectRefs = this.setInputs(componentRef, directiveInstances, desc, ctx, model);
    currentEffectRefs = currentEffectRefs.concat(this.applyModelReactivity(blockInstance));
    const subscriptions = this.wireOutputs(
      componentRef,
      directiveInstances,
      desc,
      ctx,
      options?.outputHandlers,
    );

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
        this.applyInitialModel(ctx, blockInstance, model);
        currentEffectRefs = this.setInputs(
          componentRef,
          directiveInstances,
          p.data,
          ctx,
          model,
        );
        currentEffectRefs = currentEffectRefs.concat(this.applyModelReactivity(blockInstance));
      }
    };

    return { componentRef, destroy: doDestroy, updateInputs };
  }

  /** Resolve all service types in parallel (single batch for load). */
  private async getServiceTypes(entries: { id: string }[]): Promise<(Type<unknown> | undefined)[]> {
    if (entries.length === 0) return [];
    return Promise.all(entries.map((e) => this.serviceRegistry.getType(e.id)));
  }

  /** Resolve all directive types by id in parallel. */
  private async getDirectiveTypes(ids: string[]): Promise<(Type<unknown> | undefined)[]> {
    if (ids.length === 0) return [];
    return Promise.all(ids.map((id) => this.directiveRegistry.get(id)));
  }

  /**
   * Resolve host directive instances from the component's injector (or parent).
   * Returns an array parallel to directiveTypes; entries may be null if not found.
   */
  private getDirectiveInstances(
    componentRef: ComponentRef<unknown>,
    directiveTypes: Type<unknown>[],
  ): (Record<string, unknown> | null)[] {
    if (directiveTypes.length === 0) return [];
    const injector = componentRef.injector;
    return directiveTypes.map((dirType) => {
      try {
        const instance = injector.get(dirType, null);
        return instance != null && typeof instance === 'object' ? (instance as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    });
  }

  /** Return all targets (component and directives) that have this input key. */
  private getInputTargets(
    key: string,
    componentRef: ComponentRef<unknown>,
    directiveInstances: (Record<string, unknown> | null)[],
  ): InputOutputTarget[] {
    const targets: InputOutputTarget[] = [];
    const compInst = componentRef.instance as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(compInst, key)) {
      targets.push({ type: 'component', componentRef });
    }
    for (const inst of directiveInstances) {
      if (inst != null && Object.prototype.hasOwnProperty.call(inst, key)) {
        targets.push({ type: 'directive', instance: inst });
      }
    }
    return targets;
  }

  /** Return all targets (component and directives) that have a subscribable output at this key. */
  private getOutputTargets(
    key: string,
    componentRef: ComponentRef<unknown>,
    directiveInstances: (Record<string, unknown> | null)[],
  ): InputOutputTarget[] {
    const targets: InputOutputTarget[] = [];
    const hasSubscribe = (v: unknown): boolean =>
      v != null && typeof (v as { subscribe?: unknown }).subscribe === 'function';
    const compInst = componentRef.instance as Record<string, unknown>;
    if (hasSubscribe(compInst[key])) {
      targets.push({ type: 'component', componentRef });
    }
    for (const inst of directiveInstances) {
      if (inst != null && hasSubscribe(inst[key])) {
        targets.push({ type: 'directive', instance: inst });
      }
    }
    return targets;
  }

  private buildChildInjectorFromTypes(
    serviceTypes: (Type<unknown> | undefined)[],
    parentInjector: Injector = this.injector,
  ): Injector {
    const providers = serviceTypes
      .filter((t): t is Type<unknown> => t != null)
      .map((t) => ({ provide: t, useClass: t }));
    return providers.length === 0
      ? parentInjector
      : Injector.create({ providers, parent: parentInjector });
  }

  /** Set a resolved value on a single target (component or directive). */
  private setInputOnTarget(target: InputOutputTarget, key: string, value: unknown): void {
    if (target.type === 'component') {
      if (target.componentRef.setInput) {
        target.componentRef.setInput(key as never, value as never);
      }
    } else {
      const inst = target.instance;
      const current = inst[key];
      if (isWritableSignal(current)) {
        current.set(value);
      } else {
        inst[key] = value;
      }
    }
  }

  /** Set inputs and wire template/two-way effects. Only processes keys that exist on component or a directive. */
  private setInputs(
    componentRef: ComponentRef<unknown>,
    directiveInstances: (Record<string, unknown> | null)[],
    desc: BlockDescription,
    ctx: ResolverContext,
    blockModel?: Signal<unknown | undefined>,
  ): EffectRef[] {
    const effectRefs: EffectRef[] = [];
    const inputs = desc.inputs ?? {};
    const inst = componentRef.instance as CurrentInstance;

    if ('registry' in inst) {
      const model = inst['registry'];
      if (isSignal(model) && componentRef.setInput) {
        componentRef.setInput('registry', ctx.registry);
      }
    }

    for (const [key, value] of Object.entries(inputs)) {
      const targets = this.getInputTargets(key, componentRef, directiveInstances);
      if (targets.length === 0) {
        console.warn(
          `Block input "${key}" is not defined on the component or any host directive; skipping.`,
        );
        continue;
      }

      if (typeof value === 'string') {
        const twoWayKind = classifyTwoWayString(value);
        if (twoWayKind === 'invalid-mix') {
          throw new Error(
            `Invalid input "${String(key)}": two-way ref "[( )]" cannot be mixed with literals or "{{ }}". ` +
              `Use exactly "[(refPath)]" for two-way or "{{ refPath }}" for read-only.`,
          );
        }
        if (twoWayKind === 'two-way') {
          const refPath = parseTwoWayRef(value);
          if (refPath) {
            for (const target of targets) {
              const targetInst = target.type === 'component' ? target.componentRef.instance : target.instance;
              const modelSig = (targetInst as Record<string, unknown>)[key];
              if (modelSig != null && isSignal(modelSig)) {
                effectRefs.push(
                  effect(
                    () => {
                      const fromRef = getRefValue(refPath, ctx);
                      if (fromRef === undefined) return;
                      if (isWritableSignal(modelSig)) {
                        modelSig.set(fromRef);
                      } else {
                        (targetInst as Record<string, unknown>)[key] = fromRef;
                      }
                    },
                    { injector: this.injector },
                  ),
                );
                effectRefs.push(
                  effect(
                    () => {
                      const current = modelSig();
                      setRefValue(refPath, ctx, current);
                    },
                    { injector: this.injector },
                  ),
                );
              }
            }
          }
          continue;
        }
      }
      const str = value as string;
      if (
        typeof value === 'string' &&
        str.indexOf('{{') !== -1 &&
        str.indexOf('}}', str.indexOf('{{')) !== -1
      ) {
        effectRefs.push(
          effect(
            () => {
              const resolved = this.interpolateTemplateMixed(str, ctx);
              for (const target of targets) {
                this.setInputOnTarget(target, key, resolved);
              }
            },
            { injector: this.injector },
          ),
        );
        continue;
      }

      const resolved = this.resolveInputValue(value, ctx);
      for (const target of targets) {
        this.setInputOnTarget(target, key, resolved);
      }
    }
    return effectRefs;
  }

  /** Resolve model from desc (interpolate ref if string) and set on services and blockInstance. */
  private applyInitialModel(
    ctx: ResolverContext,
    blockInstance: CurrentInstance,
    blockModel: Signal<unknown | undefined>,
  ): void {
    const directiveModel = blockModel();
    let blockInstanceModel: Signal<unknown | undefined> | undefined;
    if (typeof directiveModel === 'string') {
      const refPath = directiveModel;
      if (refPath.length > 0) {
        const refSignal = getRefSignal(refPath, ctx);
        if (refSignal != null) {
          blockInstanceModel = refSignal;
        } else {
          console.warn(`Model ref "${directiveModel}" not found.`);
          return;
        }
      }
    } else {
      blockInstanceModel = blockModel;
    }

    if (blockInstanceModel != null) {
      blockInstance['model'] = blockInstanceModel;
    }
  }

  /** If model is a ref string, return an effect that keeps setModel/blockInstance in sync with the ref. */
  private applyModelReactivity(blockInstance: CurrentInstance): EffectRef[] {
    const blockModel = blockInstance['model'] as Signal<unknown | undefined>;

    if (!isSignal(blockModel)) {
      return [];
    }

    const effectRef = effect(
      () => {
        const model = blockModel();
        for (const svc of Object.values(blockInstance)) {
          if (svc != null && typeof (svc as CurrentInstance)['setModel'] === 'function') {
            ((svc as CurrentInstance)['setModel'] as (v: unknown) => void)(model);
          }
        }
      },
      { injector: this.injector },
    );
    return [effectRef];
  }

  /**
   * Replace each {{ refPath }} with a value: resolve as ref first (e.g. PersonForm:FormState.firstName),
   * else as model path (e.g. age). Format: "model.path" or "BlockID:model.path". Allows mixing both in one template.
   */
  private interpolateTemplateMixed(template: string, ctx: ResolverContext): string {
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
      /** Resolve ref path or get value from model if ref path is not found. */
      const resolved = resolveRefPath(ref, ctx);
      const val = ref
        ? resolved != null
          ? getRefValue(ref, ctx)
          : getValueByPath(ctx.currentInstance?.model?.() ?? {}, ref)
        : null;
      parts.push(val != null ? String(val) : '');
      s = s.slice(end + 2);
    }
    return parts.join('');
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
    options?: { preserveTwoWayRefs?: boolean },
  ): unknown {
    const preserveTwoWayRefs = options?.preserveTwoWayRefs ?? false;
    if (typeof value === 'string') {
      const twoWayKind = classifyTwoWayString(value);
      if (twoWayKind === 'invalid-mix') {
        const preview = value.length > 200 ? `${value.slice(0, 200)}...` : value;
        throw new Error(
          `Invalid input: two-way ref "[( )]" cannot be mixed with literals or "{{ }}". ` +
            `Use exactly "[(refPath)]" for two-way or "{{ refPath }}" for read-only. Got: ${JSON.stringify(preview)}`,
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
      const isNestedBlockDescriptor = typeof obj['component'] === 'string' && obj['inputs'] != null;
      const entries = Object.entries(value as Record<string, unknown>);
      const resolvedPairs: [string, unknown][] = [];
      let changed = false;
      for (const [k, v] of entries) {
        const childOptions =
          isNestedBlockDescriptor && k === 'inputs' ? { preserveTwoWayRefs: true } : options;
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
    directiveInstances: (Record<string, unknown> | null)[],
    desc: BlockDescription,
    ctx: ResolverContext,
    outputHandlers?: Record<string, (value: unknown) => void>,
  ): Subscription[] {
    const subs: Subscription[] = [];
    const outputs = desc.outputs ?? {};
    const emitterType = {
      subscribe: (fn: (v: unknown) => void) => ({ unsubscribe: () => {} }),
    };
    type Subscribable = typeof emitterType;

    for (const [outputKey, outputValue] of Object.entries(outputs)) {
      const targets = this.getOutputTargets(outputKey, componentRef, directiveInstances);
      if (targets.length === 0) {
        console.warn(
          `Block output "${outputKey}" is not defined on the component or any host directive; skipping.`,
        );
        continue;
      }

      const handler = createOutputHandler(outputValue, outputKey, ctx, outputHandlers);
      for (const target of targets) {
        const inst = target.type === 'component' ? target.componentRef.instance : target.instance;
        const emitter = (inst as Record<string, unknown>)[outputKey];
        if (
          emitter != null &&
          typeof (emitter as Subscribable).subscribe === 'function'
        ) {
          const sub = (emitter as Subscribable).subscribe((v: unknown) => handler(v));
          subs.push(sub as unknown as Subscription);
        }
      }
    }
    return subs;
  }
}
