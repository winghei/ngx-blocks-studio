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
import { safeParseBlockDescription } from './block-description.schema';

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

  constructor() {
    effect(() => {
      const desc = this.description();
      const outputHandlers = this.outputHandlers();

      if (desc == null) {
        this.clear();
        return;
      }

      const parsed = safeParseBlockDescription(desc);
      if (!parsed.success) {
        return;
      }
      const data = parsed.data;
      const canUpdate =
        this.loadResult != null &&
        this.loadedComponent === data.component &&
        this.loadedServicesKey === JSON.stringify(data.services ?? []);

      if (canUpdate && this.loadResult) {
        this.loadResult.updateInputs(desc);
        return;
      }

      this.clear();
      const registry = this.blockRegistry() ?? undefined;
      this.loader
        .load(desc, this.viewContainerRef, {
          outputHandlers: Object.keys(outputHandlers).length > 0 ? outputHandlers : undefined,
          registry,
        })
        .then((result) => {
          this.loadResult = result;
          this.loadedComponent = data.component;
          this.loadedServicesKey = JSON.stringify(data.services ?? []);
        })
        .catch((err: unknown) => {
          console.error('Block load failed:', err);
        });
    });
    this.destroyRef.onDestroy(() => this.clear());
  }

  private clear(): void {
    if (this.loadResult) {
      this.loadResult.destroy();
      this.loadResult = null;
      this.loadedComponent = null;
      this.loadedServicesKey = null;
    }
  }
}
