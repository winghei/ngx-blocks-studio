import { Injectable, signal } from '@angular/core';

export interface DashboardModel {
  note: string;
}

const defaults: DashboardModel = {
  note: '',
};

/**
 * Dashboard form state. State and logic in service.
 * Register as 'DashboardState' with scope: 'self'.
 */
@Injectable()
export class DashboardStateService {
  readonly note = signal<string>(defaults.note);

  setModel(model: Partial<DashboardModel> | null): void {
    if (model == null) {
      this.note.set(defaults.note);
      return;
    }
    if (model.note !== undefined) this.note.set(model.note);
  }
}
