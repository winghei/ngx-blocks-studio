import {
  Directive,
  input,
  effect,
  ViewContainerRef,
  inject,
  DestroyRef,
} from '@angular/core';
import { safeParseDynamicComponentDescriptor } from './dynamic-component-descriptor';
import {
  DynamicComponentLoaderService,
  type DynamicComponentLoadResult,
} from './dynamic-component-loader.service';
import type { DynamicBlockRegistry } from './dynamic-block-registry';

@Directive({
  selector: '[block]',
  standalone: true,
})
export class BlockDirective {
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly loader = inject(DynamicComponentLoaderService);
  private readonly destroyRef = inject(DestroyRef);

  /** JSON descriptor: { component, id?, services?, model?, input?, output? }. Model = combined input/output state; input may contain rows/columns of child descriptors. */
  readonly block = input<unknown | null>(null);
  /** Handlers for component outputs; keys match descriptor.output names. */
  readonly outputs = input<Record<string, (value: unknown) => void>>();
  /** Registry for block instances by id; pass from root so nested blocks share it. Layout components must pass this to child [block]. */
  readonly blockRegistry = input<DynamicBlockRegistry | null>(null);

  private loadResult: DynamicComponentLoadResult | null = null;

  private loadedComponent: string | null = null;
  private loadedServicesKey: string | null = null;

  constructor() {
    effect(() => {
      const descriptor = this.block();
      const outputHandlers = this.outputs();

      if (descriptor == null) {
        this.clear();
        return;
      }

      const parsed = safeParseDynamicComponentDescriptor(descriptor);
      if (!parsed.success) {
        return;
      }
      const desc = parsed.data;
      const canUpdate =
        this.loadResult &&
        this.loadedComponent === desc.component &&
        this.loadedServicesKey === JSON.stringify(desc.services ?? []);

      if (canUpdate && this.loadResult) {
        this.loadResult.updateInputs(descriptor);
        return;
      }

      this.clear();
      const registry = this.blockRegistry();
      this.loader
        .load(descriptor, this.viewContainerRef, {
          outputs: outputHandlers,
          registry: registry ?? undefined,
        })
        .then((result) => {
          this.loadResult = result;
          this.loadedComponent = desc.component;
          this.loadedServicesKey = JSON.stringify(desc.services ?? []);
        })
        .catch((err) => {
          console.error('Dynamic block load failed:', err);
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
