import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
} from '@angular/core';
import { BlockDirective } from 'ngx-blocks-studio';
import type { BlockRegistry } from 'ngx-blocks-studio';
import { BlockRegistryService } from '../../../core/services/block-registry.service';

@Component({
  selector: 'app-section-block',
  standalone: true,
  imports: [BlockDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './section-block.component.html',
  styleUrl: './section-block.component.scss',
})
export class SectionBlockComponent {
  readonly title = input<string>('');
  readonly children = input<any[]>([]);
  readonly model = input<unknown | undefined>(undefined);
  private readonly blockRegistry = inject(BlockRegistryService);

  getRegistry(): BlockRegistry | null {
    return this.blockRegistry.registry;
  }
}
