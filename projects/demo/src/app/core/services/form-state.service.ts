import { Injectable, signal, computed } from '@angular/core';
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
  readonly firstName = signal<string>(defaultPerson.firstName);
  readonly lastName = signal<string>(defaultPerson.lastName);
  readonly email = signal<string>(defaultPerson.email);
  readonly age = signal<number>(defaultPerson.age);
  readonly nestedSignal = signal({sub: {a: signal("SubSignal"), b: 2}});

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

  alert(message: string): void {
   console.log(message);
  }

  constructor(){
    interval(1000).subscribe(() => {
      const newSubSignal = signal("SubSignal " + new Date().toISOString());
      this.nestedSignal.set({sub: {a: newSubSignal, b: 2}});
    });
  }
}
