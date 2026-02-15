import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, input } from '@angular/core';

@Component({
  selector: 'app-html-block',
  imports: [CommonModule],
  template: `<p>{{ html() | json }}</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HtmlBlock {
  readonly html = input<unknown>({});
}
