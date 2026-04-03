import { ChangeDetectionStrategy, Component, effect, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-string-input-block',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './string-input-block.component.html',
})
export class StringInputBlockComponent {
  readonly label = input<string>('');
  readonly value = model<string>('');
  readonly placeholder = input<string>('');
}
