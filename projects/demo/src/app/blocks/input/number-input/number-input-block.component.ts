import {
  Component,
  ChangeDetectionStrategy,
  input,
  model,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-number-input-block',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './number-input-block.component.html',
})
export class NumberInputBlockComponent {
  readonly label = input<string>('');
  readonly value = model<number>(0);
  readonly min = input<number | undefined>(undefined);
  readonly max = input<number | undefined>(undefined);

  parseNumber(raw: string): number {
    return raw === '' ? 0 : Number(raw);
  }
}
