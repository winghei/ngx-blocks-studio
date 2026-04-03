import { effect, inject, Injectable, Signal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { interval } from 'rxjs';

/**
 * General model service for block-based forms.
 * Exposed as instance.GeneralModel for ref resolution and two-way binding.
 * Register with ServiceRegistry as 'GeneralModel' and use scope: 'self' per form.
 */
@Injectable()
export class GeneralModelService {
  readonly router = inject(Router);
  model = signal<Signal<Record<string, unknown>> | undefined>(undefined);

  readonly time = signal<string>(new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }));

  constructor() {
    effect(() => {
      this.updateModel();
    });

    interval(1000).subscribe(() => {
      this.time.set(new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
    });
  }

  updateModel(): void {
    const baseModel = this.model();
    if (!baseModel) return;
    const resolvedModel = baseModel();
    const service = this as any;
    Object.keys(resolvedModel).forEach((key) => {
      if (service[key]) {
        service[key].set(resolvedModel[key]);
      } else service[key] = signal(resolvedModel[key]);
    });
  }

  setModel(): void {
    this.updateModel();
  }

  test(value: any): void {
    console.log(value);
  }
}
