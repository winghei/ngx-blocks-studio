import {
  Directive,
  input,
  effect,
  ViewContainerRef,
  inject,
  DestroyRef,
} from '@angular/core';
import { BlockLoaderService, type BlockLoadResult } from './block-loader.service';
import type { BlockRegistry } from './block-registry';
import type { BlockDescription } from './block-description.schema';
import {
  safeParseBlockDescription,
  normalizeServices,
  isBlockReference,
  resolveBlockReference,
} from './block-description.schema';
import { BlockDefinitionsRegistry } from './block-definitions.registry';

/** Compact key for services to avoid JSON.stringify of large config in effect. */
function getServicesKey(services: BlockDescription['services']): string {
  const arr = normalizeServices(services);
  if (arr.length === 0) return '';
  return arr.map((s) => (typeof s === 'string' ? s : `${(s as { id: string }).id}:${(s as { scope?: string }).scope ?? ''}`)).join(',');
}

@Directive({
  selector: '[block]',
  standalone: true,
})
export class BlockDirective {
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly loader = inject(BlockLoaderService);
  private readonly destroyRef = inject(DestroyRef);

  /** Full description, or { id } / { blockId, blockDefinition? } to reuse/override from blockDefinitions. */
  readonly description = input<unknown | null>(null);
  /** Handlers for component outputs; keys match descriptor.outputs. */
  readonly outputHandlers = input<Record<string, (value: unknown) => void>>({});
  /** Registry for block instances by id; pass from root so nested blocks share it. */
  readonly blockRegistry = input<BlockRegistry | null>(null);
  /** Map id → full description; used when description is a block reference (id/blockId). */
  readonly blockDefinitions = input<Record<string, unknown> | null>(null);

  private loadResult: BlockLoadResult | null = null;
  private loadedComponent: string | null = null;
  private loadedServicesKey: string | null = null;
  private loadGeneration = 0;
  /** Avoid re-parsing when the same description reference is passed (e.g. stable signal). */
  private lastDescRef: unknown = null;
  private lastParsedData: BlockDescription | null = null;

  constructor() {
    effect(() => {
      const desc = this.description();
      const outputHandlers = this.outputHandlers();
      const inputDefs = this.blockDefinitions();
      const global = BlockDefinitionsRegistry.getInstance().getAll();
      const definitions = { ...global, ...(inputDefs ?? {}) };

      if (desc == null) {
        this.lastDescRef = null;
        this.lastParsedData = null;
        this.clear();
        return;
      }

      const resolved = isBlockReference(desc)
        ? resolveBlockReference(desc, definitions)
        : desc;

      let data: BlockDescription;
      if (resolved === this.lastDescRef && this.lastParsedData != null) {
        data = this.lastParsedData;
      } else {
        const parsed = safeParseBlockDescription(resolved);
        if (!parsed.success) {
          return;
        }
        this.lastDescRef = resolved;
        this.lastParsedData = parsed.data;
        data = parsed.data;
      }
      const servicesKey = getServicesKey(data.services);
      const canUpdate =
        this.loadResult != null &&
        this.loadedComponent === data.component &&
        this.loadedServicesKey === servicesKey;

      if (canUpdate && this.loadResult) {
        this.loadResult.updateInputs(resolved);
        return;
      }

      this.clear();
      const registry = this.blockRegistry() ?? undefined;
      const generation = ++this.loadGeneration;
      this.loader
        .load(resolved, this.viewContainerRef, {
          outputHandlers: Object.keys(outputHandlers).length > 0 ? outputHandlers : undefined,
          registry,
          blockDefinitions: definitions ?? undefined,
        })
        .then((result) => {
          if (generation !== this.loadGeneration) return;
          this.loadResult = result;
          this.loadedComponent = data.component;
          this.loadedServicesKey = servicesKey;
        })
        .catch((err: unknown) => {
          if (generation !== this.loadGeneration) return;
          console.error('Block load failed:', err);
        });
    });
    this.destroyRef.onDestroy(() => this.clear());
  }

  private clear(): void {
    this.loadGeneration++;
    this.lastDescRef = null;
    this.lastParsedData = null;
    if (this.loadResult) {
      this.loadResult.destroy();
      this.loadResult = null;
      this.loadedComponent = null;
      this.loadedServicesKey = null;
    }
  }
}
