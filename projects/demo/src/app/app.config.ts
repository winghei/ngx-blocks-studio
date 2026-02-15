import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  Injector,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { RouteLoader } from 'ngx-blocks-studio';
import { registerDemoBlocks } from './core/registry/demo-registry.config';
import { personFormRoute } from './route-data/person-form.block';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter([]),
    provideAppInitializer(() => {
      const routeLoader = inject(RouteLoader);
      registerDemoBlocks(inject(Injector));
      return routeLoader.loadRoutes({
        routes: [{ ...personFormRoute }],
        defaultRedirect: '',
        catchAllRedirect: '',
      });
    }),
  ],
};
