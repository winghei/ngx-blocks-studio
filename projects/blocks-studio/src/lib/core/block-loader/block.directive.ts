import {
  Directive,
  input,
  effect,
  ViewContainerRef,
  inject,
  DestroyRef,
  type ComponentRef,
} from '@angular/core';
import { BlockLoaderService } from './block-loader.service';
import type { BlockRegistry } from './block-registry';
import type { BlockDefinitionOrLoader } from '../registry/block-definitions.registry';
import type { BlockDescription, BlockInput } from './block-description.schema';
import {
  safeParseBlockDescription,
  normalizeServices,
  isBlockReference,
  resolveBlockReference,
  type BlockReference,
} from './block-description.schema';

/** Compact key for services to avoid JSON.stringify of large config in effect. */
function getServicesKey(services: BlockDescription['services']): string {
  const arr = normalizeServices(services);
  if (arr.length === 0) return '';
  return arr
    .map((s) =>
      typeof s === 'string'
        ? s
        : `${(s as { id: string }).id}:${(s as { scope?: string }).scope ?? ''}`,
    )
    .join(',');
}

function safeJsonKey(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return String(value);
  }
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
  readonly description = input<BlockInput | BlockReference | null>(null);
  /** Registry for block instances by id; pass from root so nested blocks share it. */
  readonly blockRegistry = input<BlockRegistry | null>(null);
  /** Map id → full description or loader; used when description is a block reference (id/blockId). */
  readonly blockDefinitions = input<Record<string, BlockDefinitionOrLoader> | null>(null);
  /** Model for the block. */
  readonly model = input<Record<string, unknown> | string | undefined>(undefined);
  /**
   * Forces a reload when this value changes, even if component/services are the same.
   * Useful for "same component, different inputs" scenarios like tabs/switch blocks.
   */
  readonly reloadKey = input<unknown>(null);

  private loadResult: ComponentRef<unknown> | null = null;
  private lastRegistry: BlockRegistry | null = null;
  private lastId: string | null = null;
  private loadedComponent: string | null = null;
  private loadedServicesKey: string | null = null;
  private loadedReloadKey: unknown = null;
  private loadedDescKey: string | null = null;
  private loadGeneration = 0;
  /** Invalidates in-flight block-reference resolution when the effect re-runs. */
  private effectRunId = 0;
  /** Avoid re-parsing when the same description reference is passed (e.g. stable signal). */
  private lastDescRef: unknown = null;
  private lastParsedData: BlockDescription | null = null;

  constructor() {
    effect(() => {
      const desc = this.description();
      const inputDefs = this.blockDefinitions();
      const reloadKey = this.reloadKey();
      const runId = ++this.effectRunId;

      if (desc == null) {
        this.lastDescRef = null;
        this.lastParsedData = null;
        this.clear();
        return;
      }

      const runAfterResolved = (resolved: Record<string, unknown>) => {
        if (runId !== this.effectRunId) {
          return;
        }

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
        const descKey = safeJsonKey(resolved);
        const effectiveReloadKey = reloadKey ?? descKey;

        // Only clear when the logical description changed (component or services). Avoids
        // clear+reload when the parent passes a new reference with the same content (e.g. BlockFor).
        const mustReload =
          this.loadResult == null ||
          this.loadedComponent !== data.component ||
          this.loadedServicesKey !== servicesKey ||
          this.loadedReloadKey !== effectiveReloadKey ||
          this.loadedDescKey !== descKey;
        if (!mustReload) {
          // Description is logically unchanged (same component + services); no work needed.
          return;
        }

        this.clear();
        const registry = this.blockRegistry() ?? undefined;
        this.lastRegistry = registry ?? null;
        this.lastId = data.id ?? null;

        const generation = ++this.loadGeneration;
        this.loader
          .load(resolved, this.viewContainerRef, this.model, {
            registry,
            blockDefinitions: inputDefs ?? undefined,
          })
          .then((result) => {
            if (generation !== this.loadGeneration) return;
            this.loadResult = result;
            this.loadedComponent = data.component;
            this.loadedServicesKey = servicesKey;
            this.loadedReloadKey = effectiveReloadKey;
            this.loadedDescKey = descKey;
          })
          .catch((err: unknown) => {
            if (generation !== this.loadGeneration) return;
            console.error('Block load failed:', err);
          });
      };

      if (isBlockReference(desc)) {
        void resolveBlockReference(desc, inputDefs ?? undefined)
          .then((resolved) => {
            runAfterResolved(resolved);
          })
          .catch((err: unknown) => {
            if (runId !== this.effectRunId) return;
            console.error('Block reference resolution failed:', err);
          });
        return;
      }

      runAfterResolved(desc as Record<string, unknown>);
    });

    this.destroyRef.onDestroy(() => this.clear());
  }

  private clear(): void {
    this.loadGeneration++;
    this.lastDescRef = null;
    this.lastParsedData = null;
    if (this.lastId != null) {
      this.lastRegistry?.unregister(this.lastId);
      this.lastId = null;
    }
    if (this.loadResult) {
      this.viewContainerRef.clear();
      this.loadResult = null;
      this.loadedComponent = null;
      this.loadedServicesKey = null;
      this.loadedReloadKey = null;
      this.loadedDescKey = null;
    }
  }
}
