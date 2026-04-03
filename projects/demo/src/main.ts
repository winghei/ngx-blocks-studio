import { initCSSRuntime } from '@master/css-runtime';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppShellComponent } from './app/blocks/shell/app-shell.component';
import masterCssConfig from './master-css.config';

initCSSRuntime(masterCssConfig);

bootstrapApplication(AppShellComponent, appConfig).catch((err) =>
  console.error(err)
);
