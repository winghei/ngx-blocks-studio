import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostBinding, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-link-block',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-block.component.html',
})
export class LinkBlockComponent {
  readonly routerLink = input<string | string[]>([]);
  readonly class = input<string[]>([]);
  readonly label = input<string>('');
  readonly style = input<Record<string, unknown>>({});

  linkClasses(): string {
    const fromInput = this.class();
    const extra = typeof fromInput === 'string' ? [] : fromInput;
    return ['link-block', ...extra].join(' ');
  }

  @HostBinding('style') get hostStyle(): Record<string, unknown> {
    return this.style();
  }
}
