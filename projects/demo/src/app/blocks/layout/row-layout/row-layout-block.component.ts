import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
} from '@angular/core';
import { BlockDirective } from 'ngx-blocks-studio';
import type { BlockRegistry } from 'ngx-blocks-studio';
import { BlockRegistryService } from '../../../core/services/block-registry.service';

export interface RowColumn {
  columns: unknown[];
}

@Component({
  selector: 'app-row-layout-block',
  standalone: true,
  imports: [BlockDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './row-layout-block.component.html',
  styleUrl: './row-layout-block.component.scss',
})
export class RowLayoutBlockComponent {
  readonly rows = input<RowColumn[]>([]);
  private readonly blockRegistry = inject(BlockRegistryService);

  getRegistry(): BlockRegistry | null {
    return this.blockRegistry.registry;
  }
}
