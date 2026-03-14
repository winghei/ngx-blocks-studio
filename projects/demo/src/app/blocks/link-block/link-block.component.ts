import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, HostBinding, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-link-block',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-block.component.html',
  styles: [
    `
      .link-block {
        cursor: pointer;
        text-decoration: underline;
        &:hover {
          opacity: 0.8;
        }
      }
    `,
  ],
})
export class LinkBlockComponent {
  readonly routerLink = input<string | string[]>([]);
  readonly class = input<string[]>([]);
  readonly label = input<string>('');
  readonly style = input<Record<string, unknown>>({});

  @HostBinding('class') get hostClass(): string {
    if (typeof this.class() === 'string') {
      return '';
    }
    return this.class().join(' ');
  }

  @HostBinding('style') get hostStyle(): Record<string, unknown> {
    return this.style();
  }
}
