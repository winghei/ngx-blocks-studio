import { Injectable, signal, computed } from '@angular/core';

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
 * Exposed as instance.FormState for ref resolution and two-way binding.
 * Register with ServiceRegistry as 'FormState' and use scope: 'self' per form.
 */
@Injectable({ providedIn: 'root' })
export class FormStateService {
  readonly firstName = signal<string>(defaultPerson.firstName);
  readonly lastName = signal<string>(defaultPerson.lastName);
  readonly email = signal<string>(defaultPerson.email);
  readonly age = signal<number>(defaultPerson.age);

  readonly model = computed<PersonModel>(() => ({
    firstName: this.firstName(),
    lastName: this.lastName(),
    email: this.email(),
    age: this.age(),
  }));

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
}
