import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
} from '@angular/core';
import { BlockDirective } from 'ngx-blocks-studio';
import type { BlockRegistry } from 'ngx-blocks-studio';
import { BlockRegistryService } from '../../../core/services/block-registry.service';
import { CommonModule } from '@angular/common';

export interface RowColumn {
  columns: any[];
}

@Component({
  selector: 'app-row-layout-block',
  standalone: true,
  imports: [BlockDirective, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './row-layout-block.component.html',
  styleUrl: './row-layout-block.component.scss',
})
export class RowLayoutBlockComponent {
  readonly rows = input<RowColumn[]>([]);
  readonly model = input<Record<string, unknown> | string | undefined>(undefined);
  readonly registry = input<BlockRegistry | null>(null);
  readonly blockRegistry = inject(BlockRegistryService);

  getRegistry(): BlockRegistry | null {
    return this.blockRegistry.registry;
  }
}
