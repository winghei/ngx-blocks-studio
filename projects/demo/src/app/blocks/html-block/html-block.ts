import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-html-block',
  imports: [CommonModule],
  template: `<div class="html-block-content" [innerHTML]="html()"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HtmlBlock {
  readonly html = input<string>('');
}
