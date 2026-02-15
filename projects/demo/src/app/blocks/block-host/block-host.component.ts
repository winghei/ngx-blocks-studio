import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BlockDirective } from 'ngx-blocks-studio';
import { BlockRegistryService } from '../../core/services/block-registry.service';
import type { BlockRegistry } from 'ngx-blocks-studio';

@Component({
  selector: 'app-block-host',
  standalone: true,
  imports: [BlockDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './block-host.component.html',
  styleUrl: './block-host.component.scss',
})
export class BlockHostComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly blockRegistry = inject(BlockRegistryService);

  private readonly routeData = toSignal(this.route.data, {
    initialValue: {} as Record<string, unknown>,
  });

  readonly blockDescription = computed(() => this.routeData()['block'] ?? null);

  getRegistry(): BlockRegistry {
    return this.blockRegistry.registry;
  }
}
