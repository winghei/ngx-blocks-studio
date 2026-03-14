/**
 * Route data: block definitions and route configs for the demo app.
 *
 * Each *.block.ts file exports a block definition and optionally route(s).
 * Blocks are registered in app.config (BlockDefinitionsRegistry) so routes
 * can use `{ blockId: 'X' }` without passing blockDefinitions in every route.
 *
 * Schema: Block descriptions and references follow the ngx-blocks schema.
 * @see docs/schemas/ngx-blocks.schema.json
 */

// ─── Block definitions (layout / shared) ───────────────────────────────────
import { appNavBlock } from './nav.block';

// ─── Block definitions (pages) ─────────────────────────────────────────────
import { dashboardBlock, dashboardRoute } from './dashboard.block';
import { docsBlock, docsRoute } from './docs/index.block';
import { examplesBlock, examplesRoute } from './examples.block';
import { homeRoute } from './home.block';
import { loginBlock, loginRoute } from './login.block';
import { personFormBlock, routes as personFormRoutes } from './person-form.block';

/** All block definitions: blockId → definition (for registration and route data). */
export const blockDefinitions = {
  AppNav: appNavBlock,
  PersonForm: personFormBlock,
  LoginPage: loginBlock,
  DashboardPage: dashboardBlock,
  DocsPage: docsBlock,
  ExamplesPage: examplesBlock,
} as const;

/** All demo routes (path, component, data with block + blockDefinitions). */
export const routes = [
  homeRoute,
  docsRoute,
  ...personFormRoutes,
  loginRoute,
  dashboardRoute,
  examplesRoute,
];

// ─── Re-exports (for direct imports from route-data) ─────────────────────────
export { dashboardBlock, dashboardRoute } from './dashboard.block';
export { docsBlock, docsRoute } from './docs/index.block';
export { examplesBlock, examplesRoute } from './examples.block';
export { homeRoute } from './home.block';
export { loginBlock, loginRoute } from './login.block';
export { appNavBlock } from './nav.block';
export { personFormBlock, routes as personFormRoutes } from './person-form.block';

