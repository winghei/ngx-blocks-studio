import {
  Directive,
  input,
  effect,
  ViewContainerRef,
  inject,
  DestroyRef,
} from '@angular/core';
import { BlockLoaderService } from './block-loader.service';
import type { BlockRegistry } from './block-registry';
import type { BlockDefinitionOrLoader } from '../registry/block-definitions.registry';
import type { BlockInput } from './block-description.schema';
import type { BlockReference } from './block-description.schema';
import {
  clearBlockDirective,
  createInitialBlockDirectiveLoadState,
  runBlockDirectiveEffect,
} from './block-directive-effect';

@Directive({
  selector: '[block]',
  standalone: true,
})
export class BlockDirective {
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly loader = inject(BlockLoaderService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadState = createInitialBlockDirectiveLoadState();

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

  loadBlock(
    resolved: BlockInput | BlockReference,
    registry?: BlockRegistry,
    blockDefinitions?: Record<string, BlockDefinitionOrLoader>,
  ) {
    return this.loader.load(resolved, this.viewContainerRef, this.model, {
      registry,
      blockDefinitions,
    });
  }

  constructor() {
    effect(() => {
      runBlockDirectiveEffect(
        this.loadState,
        {
          viewContainerRef: this.viewContainerRef,
          loadBlock: this.loadBlock.bind(this),
        },
        this.description(),
        this.blockDefinitions(),
        this.blockRegistry(),
        this.reloadKey(),
      );
    });

    this.destroyRef.onDestroy(() => clearBlockDirective(this.loadState, this.viewContainerRef));
  }
}
