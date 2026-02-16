import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  Injector,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { BlockDefinitionsRegistry, RouteLoader } from 'ngx-blocks-studio';
import { registerDemoBlocks } from './core/registry/demo-registry.config';
import {
  personFormBlock,
  routes as personFormRoutes,
} from './route-data/person-form.block';
import { loginBlock, loginRoute } from './route-data/login.block';
import { dashboardBlock, dashboardRoute } from './route-data/dashboard.block';
import { appNavBlock } from './route-data/nav.block';

const routes = [...personFormRoutes, loginRoute, dashboardRoute];

/** Register block templates so they can be resolved by id (e.g. { id: 'AppNav' }) without passing blockDefinitions down. */
function registerBlockDefinitions(): void {
  const registry = BlockDefinitionsRegistry.getInstance();
  registry.register('PersonForm', personFormBlock as Record<string, unknown>);
  registry.register('LoginPage', loginBlock as Record<string, unknown>);
  registry.register('DashboardPage', dashboardBlock as Record<string, unknown>);
  registry.register('AppNav', appNavBlock as Record<string, unknown>);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter([]),
    provideAppInitializer(() => {
      const routeLoader = inject(RouteLoader);
      registerDemoBlocks(inject(Injector));
      registerBlockDefinitions();
      return routeLoader.loadRoutes({
        routes,
        defaultRedirect: '',
        catchAllRedirect: '',
      });
    }),
  ],
};
