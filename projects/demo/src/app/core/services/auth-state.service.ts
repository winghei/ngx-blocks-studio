import { Injectable, signal } from '@angular/core';

export interface AuthModel {
  username: string;
  password: string;
}

const defaults: AuthModel = {
  username: '',
  password: '',
};

/**
 * Dummy auth state for the login block. State and logic in service.
 * Register as 'AuthState' with scope: 'self'.
 */
@Injectable()
export class AuthStateService {
  readonly username = signal<string>(defaults.username);
  readonly password = signal<string>(defaults.password);

  setModel(model: Partial<AuthModel> | null): void {
    if (model == null) {
      this.username.set(defaults.username);
      this.password.set(defaults.password);
      return;
    }
    if (model.username !== undefined) this.username.set(model.username);
    if (model.password !== undefined) this.password.set(model.password);
  }
}
