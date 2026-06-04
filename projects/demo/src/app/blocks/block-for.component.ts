import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  inject,
  input,
  model,
} from '@angular/core';
import { BlockDirective, BlockRegistry } from 'ngx-blocks-studio';
import { BlockRegistryService } from '../core/services/block-registry.service';

@Component({
  selector: 'block-for',
  standalone: true,
  imports: [BlockDirective, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (item of items(); track trackByFn($index, item); let i = $index) {
      <ng-container block [description]="block()" [model]="item" [blockRegistry]="registry()" />
    }
  `,
})
export class BlockForComponent {
  private readonly blockRegistry = inject(BlockRegistryService);
  readonly items = model<any[]>([]);
  readonly trackBy = input<string | undefined>(undefined);
  readonly trackByIdx = input<boolean>(false);
  readonly block = input.required<{ component: string; inputs?: Record<string, unknown> }>();
  readonly blockDefinitions = input<Record<string, unknown>>({});
  readonly class = input<string[]>([]);
  readonly style = input<Record<string, unknown>>({});
  readonly registry = input<BlockRegistry | null>(
    this.blockRegistry.registry as unknown as BlockRegistry | null,
  );
  trackByFn(idx: number, item: unknown) {
    if (this.trackByIdx()) {
      return idx;
    }
    const trackBy = this.trackBy();
    if (trackBy) {
      if (item && typeof item === 'object' && trackBy in item) {
        return (item as Record<string, unknown>)[trackBy];
      }
      return item;
    }
    return item;
  }

  @HostBinding('class') get hostClass(): string {
    return this.class().join(' ');
  }

  @HostBinding('style') get hostStyle(): Record<string, unknown> {
    return this.style();
  }
}
