import { Injectable, signal, computed, linkedSignal } from '@angular/core';
import { interval } from 'rxjs';

export interface PersonModel {
  firstName: string;
  lastName: string;
  email: string;
  age: number;
}

const defaultPerson: PersonModel = {
  firstName: '',
  lastName: '',
  email: '',
  age: 0,
};

/**
 * Form state service for block-based forms.
 * Exposed as FormState on the block instance for ref resolution and two-way binding.
 * Register with ServiceRegistry as 'FormState' and use scope: 'self' per form.
 */

@Injectable({ providedIn: 'root' })
export class FormStateService {
  model = signal<PersonModel | null>({firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', age: 30});
  readonly firstName = linkedSignal(()=> this.model()?.firstName);
  readonly lastName = linkedSignal(()=> this.model()?.lastName);
  readonly email = linkedSignal(()=> this.model()?.email);
  readonly age = linkedSignal(()=> this.model()?.age);
  readonly time = signal<string>(
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  );
  
  readonly nestedSignal = signal({ sub: { a: signal('SubSignal'), b: 2 } });

  setModel(model: Partial<PersonModel> | null): void {
    if (model == null) {
      this.firstName.set(defaultPerson.firstName);
      this.lastName.set(defaultPerson.lastName);
      this.email.set(defaultPerson.email);
      this.age.set(defaultPerson.age);
      return;
    }
    if (model.firstName !== undefined) this.firstName.set(model.firstName);
    if (model.lastName !== undefined) this.lastName.set(model.lastName);
    if (model.email !== undefined) this.email.set(model.email);
    if (model.age !== undefined) this.age.set(model.age);
  }

  alert(message: string): void {
    console.log('FormState.alert', message);
  }

  constructor() {
    interval(1000).subscribe(() => {
      const newSubSignal = signal('SubSignal ' + new Date().toISOString());
      this.nestedSignal.set({ sub: { a: newSubSignal, b: 2 } });
    });
    interval(1000).subscribe(() => {
      this.time.set(
        new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    });
  }
}
