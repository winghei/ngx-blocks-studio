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
  styleUrl: './number-input-block.component.scss',
})
export class NumberInputBlockComponent {
  readonly label = input<string>('');
  readonly value = input<number>(0);
  readonly valueChange = output<number>();
  readonly min = input<number | undefined>(undefined);
  readonly max = input<number | undefined>(undefined);

  parseNumber(raw: string): number {
    return raw === '' ? 0 : Number(raw);
  }
}
