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
import { blockDefinitions, routes } from './route-data';

/**
 * Block-directive use cases (bindings, services, directive I/O, block refs, outputs):
 * See docs/block-directive-use-cases.md in the repo root.
 *
 * Demo routes and block registrations illustrate:
 * - Block references: routes use { blockId: 'PersonForm' } etc.; rows use { blockId: 'AppNav' }
 * - Services: root vs self-scoped in person-form, login, dashboard, examples, card blocks
 * - Inputs: literal, {{ refPath }}, [( refPath )] in route-data/*.block.ts
 * - Outputs: reference handlers (e.g. valueChange → FormState.age.set) in person-form.block.ts
 */

/**
 * Register block definitions by id so they can be resolved by blockId (e.g. { blockId: 'AppNav' })
 * without passing blockDefinitions in route data. Required for block reference use case.
 */
function registerBlockDefinitions(): void {
  const registry = BlockDefinitionsRegistry.getInstance();
  for (const [id, definition] of Object.entries(blockDefinitions)) {
    registry.register(id, definition as Record<string, unknown>);
  }
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
