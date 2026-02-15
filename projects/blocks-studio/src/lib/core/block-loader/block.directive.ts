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
import { safeParseBlockDescription, normalizeServices } from './block-description.schema';

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

  /** JSON description: { component, id?, services?, inputs?, outputs? }. */
  readonly description = input<unknown | null>(null);
  /** Handlers for component outputs; keys match descriptor.outputs. */
  readonly outputHandlers = input<Record<string, (value: unknown) => void>>({});
  /** Registry for block instances by id; pass from root so nested blocks share it. */
  readonly blockRegistry = input<BlockRegistry | null>(null);

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

      if (desc == null) {
        this.lastDescRef = null;
        this.lastParsedData = null;
        this.clear();
        return;
      }

      let data: BlockDescription;
      if (desc === this.lastDescRef && this.lastParsedData != null) {
        data = this.lastParsedData;
      } else {
        const parsed = safeParseBlockDescription(desc);
        if (!parsed.success) {
          return;
        }
        this.lastDescRef = desc;
        this.lastParsedData = parsed.data;
        data = parsed.data;
      }
      const servicesKey = getServicesKey(data.services);
      const canUpdate =
        this.loadResult != null &&
        this.loadedComponent === data.component &&
        this.loadedServicesKey === servicesKey;

      if (canUpdate && this.loadResult) {
        this.loadResult.updateInputs(desc);
        return;
      }

      this.clear();
      const registry = this.blockRegistry() ?? undefined;
      const generation = ++this.loadGeneration;
      this.loader
        .load(desc, this.viewContainerRef, {
          outputHandlers: Object.keys(outputHandlers).length > 0 ? outputHandlers : undefined,
          registry,
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
