import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-html-block',
  imports: [CommonModule],
  template: `<div class="html-block-content" [innerHTML]="html()"></div>`,
  styleUrl: './html-block.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HtmlBlock {
  readonly html = input<string>('');
}
