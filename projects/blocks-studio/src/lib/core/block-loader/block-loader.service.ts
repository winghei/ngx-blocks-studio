import {
  ComponentRef,
  Injectable,
  inject,
  Injector,
  Type,
  ViewContainerRef,
  WritableSignal,
  inputBinding,
  isSignal,
  linkedSignal,
  outputBinding,
  twoWayBinding,
  type Signal,
} from '@angular/core';
import { ComponentRegistry } from '../registry/component.registry';
import { DirectiveRegistry } from '../registry/directive.registry';
import { ServiceRegistry } from '../registry/service.registry';
import { getBlockInputsAndOutputs, resolveBlockInputsAndOutputs } from './block-bindings';
import {
  BlockDescription,
  isBlockReference,
  normalizeDirectives,
  normalizeServices,
  resolveBlockReference,
  safeParseBlockDescription,
  type BlockInput,
  type BlockReference,
  type ServiceEntry,
} from './block-description.schema';
import type { BlockDefinitionOrLoader } from '../registry/block-definitions.registry';
import {
  BlockRegistryImpl,
  CurrentInstance,
  type BlockInstanceHandle,
  type BlockRegistry,
} from './block-registry';
import { ResolverContext, getRefSignal } from './ref-resolver';
import { BlockRegistryService } from '../services/block-registry.service';
import {
  resolveNestedTemplateValues,
  valueContainsMustacheInTree,
} from './nested-template-resolve';
import { resolveTemplateString } from './template-interpolation';

export interface BlockLoadOptions {
  registry?: BlockRegistry;
  /** Map of block id → full description or loader; used when description is a block reference. */
  blockDefinitions?: Record<string, BlockDefinitionOrLoader>;
}

export const INTERPOLATE_MAX_PLACEHOLDERS = 200;

/** Builds a two-way binding when only a read getter exists for the key (used by {@link createInputBindingsWithWarnings}). */
export function linkedTwoWayFromInputGetter(
  resolvedInputs: Record<string, (() => unknown) | undefined>,
  key: string,
): WritableSignal<unknown> {
  return linkedSignal(() => resolvedInputs[key]?.());
}

export function createInputBindingsWithWarnings(
  ownerName: string,
  inputKeys: Set<string>,
  twoWayKeys: Set<string>,
  outputKeys: Set<string>,
  resolvedInputs: Record<string, (() => unknown) | undefined>,
  resolvedTwoWay: Record<string, unknown>,
  resolvedOutputs: Record<string, (value: unknown) => void>,
) {
  const inputBindingsArray = Array.from(inputKeys)
    .filter((key) => {
      if (resolvedInputs[key] == null) {
        return false;
      }
      return true;
    })
    .map((key) => inputBinding(key, resolvedInputs[key]!));

  const twoWayBindingsArray = Array.from(twoWayKeys)
    .filter((key) => {
      if (resolvedTwoWay[key] == null && resolvedInputs[key] == null) {
        return false;
      }
      return true;
    })
    // resolvedTwoWay is guaranteed non-null after the filter.
    .map((key) =>
      twoWayBinding(
        key,
        (resolvedTwoWay[key] ??
          linkedTwoWayFromInputGetter(resolvedInputs, key)) as WritableSignal<unknown>,
      ),
    );

  const outputBindingsArray = Array.from(outputKeys)
    .filter((key) => {
      if (resolvedOutputs[key] == null) {
        return false;
      }
      return true;
    })
    .map((key) => outputBinding(key, resolvedOutputs[key]));

  return [...inputBindingsArray, ...twoWayBindingsArray, ...outputBindingsArray];
}

@Injectable({ providedIn: 'root' })
export class BlockLoaderService {
  private readonly componentRegistry = ComponentRegistry.getInstance();
  private readonly directiveRegistry = DirectiveRegistry.getInstance();
  private readonly serviceRegistry = ServiceRegistry.getInstance();
  private readonly blockRegistryService = inject(BlockRegistryService);

  async load(
    description: BlockInput | BlockReference,
    viewContainerRef: ViewContainerRef,
    model: Signal<unknown | undefined>,
    options?: BlockLoadOptions,
  ): Promise<ComponentRef<unknown>> {
    let resolved: unknown = description;
    if (isBlockReference(description)) {
      resolved = await resolveBlockReference(description, options?.blockDefinitions);
    }
    const parsed = safeParseBlockDescription(resolved);

    if (!parsed.success) {
      throw new Error(`Invalid block description: ${parsed.error.message}`);
    }
    const desc = parsed.data;
    const registry = options?.registry ?? new BlockRegistryImpl();
    if (desc.id != null && desc.id !== '' && registry.hasLocal(desc.id)) {
      throw new Error(`Block id "${desc.id}" is already registered.`);
    }

    const componentType = await this.componentRegistry.get(desc.component);
    if (!componentType) {
      throw new Error(`Component "${desc.component}" is not registered.`);
    }

    //... Generate and new resolver context
    const blockInstance: CurrentInstance = { services: {} };
    const ctx: ResolverContext = {
      registry,
      currentBlockId: desc.id ?? undefined,
      currentInstance: blockInstance,
      getRegistryForScope: (scopeKey: string) => this.blockRegistryService.getRegistryForScope(scopeKey),
    };

    //... Resolve model for the block
    this.resolveContextModel(ctx, model);
    const resolvedModel = blockInstance.model;

    const handle: BlockInstanceHandle = { instance: blockInstance };

    //... Register the block instance with the registry if it has an id
    if (desc.id != null && desc.id !== '') registry.register(desc.id, handle);

    //... Resolve services for the block

    await this.resolveServices(viewContainerRef, blockInstance, desc, resolvedModel, model);

    const directiveIds = normalizeDirectives(desc.directives);
    const directiveTypes = await this.getDirectiveTypes(directiveIds);
    const nonNullDirectiveTypes = directiveTypes.filter((d): d is Type<unknown> => d != null);

    // get inputs and outputs from the component and host directives
    const componentMetadata = getBlockInputsAndOutputs([componentType]);
    const directivesMetadata = nonNullDirectiveTypes.map((d) => ({
      type: d,
      metadata: getBlockInputsAndOutputs([d]),
    }));
    const inputKeys = new Set([
      ...componentMetadata.inputs,
      ...directivesMetadata.map((d) => Array.from(d.metadata.inputs)).flat(),
    ]);
    const outputKeys = new Set([
      ...componentMetadata.outputs,
      ...directivesMetadata.map((d) => Array.from(d.metadata.outputs)).flat(),
    ]);
    const twoWayKeys = new Set([
      ...componentMetadata.twoWay,
      ...directivesMetadata.map((d) => Array.from(d.metadata.twoWay)).flat(),
    ]);

    // Initial bindings for component; directive inputs are applied separately.
    const initialResolved = resolveBlockInputsAndOutputs(
      desc,
      inputKeys,
      outputKeys,
      twoWayKeys,
      ctx,
    );

    const componentBindings = [
      // Component inputs / two-way bindings
      ...createInputBindingsWithWarnings(
        'component',
        componentMetadata.inputs,
        componentMetadata.twoWay,
        componentMetadata.outputs,
        initialResolved.resolvedInputs,
        initialResolved.resolvedTwoWay,
        initialResolved.resolvedOutputs,
      ),
    ];

    const directiveAndBindings = directivesMetadata.map((d) => ({
      type: d.type,
      bindings: [
        ...createInputBindingsWithWarnings(
          `directive "${d.type.name}"`,
          d.metadata.inputs,
          d.metadata.twoWay,
          d.metadata.outputs,
          initialResolved.resolvedInputs,
          initialResolved.resolvedTwoWay,
          initialResolved.resolvedOutputs,
        ),
      ],
    }));

    const componentRef = viewContainerRef.createComponent(componentType as Type<unknown>, {
      directives: directiveAndBindings,
      bindings: componentBindings,
    });

    return componentRef;
  }

  private async resolveServices(
    viewContainerRef: ViewContainerRef,
    blockInstance: CurrentInstance,
    desc: BlockDescription,
    resolvedModel: Signal<unknown | undefined> | undefined,
    model: Signal<unknown | undefined>,
  ): Promise<void> {
    // services are stored under `blockInstance.services`, so `model` no longer collides structurally,
    // but `model` is a reserved ref keyword (`BlockId:model...`). Warn to avoid confusion.
    const reservedAliases = new Set(['services', 'model']);
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

    const rootServiceTypes = await this.getServiceTypes(rootEntries);

    for (let i = 0; i < rootEntries.length; i++) {
      const alias = rootEntries[i].alias;
      const serviceType = rootServiceTypes[i];
      if (serviceType) {
        const svc = viewContainerRef.injector.get(serviceType as Type<unknown>, null);

        if (reservedAliases.has(alias)) {
          console.warn(
            `Service alias "${alias}" is reserved and conflicts with ref keywords; skipping assignment.`,
          );
        } else if (svc != null) {
          blockInstance.services[alias] = svc;
        }
        // if the service is not found, add it to the selfServices array
        else selfServices.push({ id: alias, scope: 'self' });
      }
    }

    const selfServiceTypes = await this.getServiceTypes(selfServices);

    const selfInjector = this.buildChildInjectorFromTypes(
      selfServiceTypes,
      viewContainerRef.injector,
    );

    for (let i = 0; i < selfServices.length; i++) {
      const alias = selfServices[i].alias ?? selfServices[i].id;
      const serviceType = selfServiceTypes[i];

      if (serviceType) {
        const svc = selfInjector.get(serviceType as Type<unknown>, null, {
          self: true,
        });
        if (svc != null) {
          if (reservedAliases.has(alias)) {
            console.warn(
              `Service alias "${alias}" is reserved and conflicts with ref keywords; skipping assignment.`,
            );
          } else {
            blockInstance.services[alias] = svc;
          }
          if (
            model() != null &&
            resolvedModel != null &&
            'model' in (svc as Record<string, unknown>) &&
            isSignal((svc as { model?: unknown }).model)
          ) {
            (svc as { model: WritableSignal<any | undefined> }).model.set(resolvedModel);
            (svc as { setModel?: () => void }).setModel?.();
          }
        }
      }
    }
  }
  private buildChildInjectorFromTypes(
    serviceTypes: (Type<unknown> | undefined)[],
    parentInjector: Injector,
  ): Injector {
    const providers = serviceTypes
      .filter((t): t is Type<unknown> => t != null)
      .map((t) => ({ provide: t, useClass: t }));
    return providers.length === 0
      ? parentInjector
      : Injector.create({ providers, parent: parentInjector });
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

  /** Resolve model from desc (interpolate ref if string) and set on blockInstance. */
  private resolveContextModel(ctx: ResolverContext, blockModel: Signal<unknown | undefined>): void {
    const directiveModel = blockModel();
    const blockInstance = ctx.currentInstance;
    const templateCtx = this.withModelOverrideContext(ctx, blockModel);
    let blockInstanceModel: Signal<unknown | undefined> | undefined;
    if (typeof directiveModel === 'string') {
      const interpolated = resolveTemplateString(directiveModel, templateCtx);
      if (typeof interpolated !== 'string') {
        blockInstanceModel = linkedSignal(() => resolveTemplateString(directiveModel, templateCtx));
      } else {
        const refPath = interpolated.trim();
        if (refPath.length > 0) {
          const refSignal = getRefSignal(refPath, ctx);
          if (refSignal != null) {
            blockInstanceModel = refSignal;
          } else {
            blockInstanceModel = linkedSignal(() =>
              resolveTemplateString(directiveModel, templateCtx),
            );
          }
        }
      }
    } else {
      const hasTemplates = valueContainsMustacheInTree(directiveModel);
      blockInstanceModel = hasTemplates
        ? linkedSignal(() =>
            resolveNestedTemplateValues(
              blockModel(),
              this.withModelOverrideContext(ctx, blockModel),
              'model',
              new WeakSet(),
              { resolveTwoWayStringsAsReadonly: false },
            ),
          )
        : blockModel;
    }

    if (blockInstanceModel != null) {
      if (!blockInstance) {
        throw new Error(
          'Block instance not found in context. Make sure to pass the block registry to the block loader.',
        );
      }
      blockInstance.model = blockInstanceModel;
    }
  }

  private withModelOverrideContext(
    ctx: ResolverContext,
    model: Signal<unknown | undefined>,
  ): ResolverContext {
    if (ctx.currentInstance == null) return ctx;
    return {
      ...ctx,
      currentInstance: {
        ...ctx.currentInstance,
        model,
      },
    };
  }
}
