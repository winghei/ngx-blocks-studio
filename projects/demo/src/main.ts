import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppShellComponent } from './app/blocks/shell/app-shell.component';

bootstrapApplication(AppShellComponent, appConfig).catch((err) =>
  console.error(err)
);
