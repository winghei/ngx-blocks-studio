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
import { docsBlock, docsRoute } from './docs/index.block';
import { examplesRoute } from './examples.block';
import { homeRoute } from './home.block';
import { personFormBlock, routes as personFormRoutes } from './person-form.block';

/** All block definitions: blockId → definition (for registration and route data). */
export const blockDefinitions = {
  AppNav: appNavBlock,
  PersonForm: personFormBlock,
  DocsPage: docsBlock,
} as const;

/** All demo routes (path, component, data with block + blockDefinitions). */
export const routes = [homeRoute, docsRoute, ...personFormRoutes, examplesRoute];

// ─── Re-exports (for direct imports from route-data) ─────────────────────────
export { docsBlock, docsRoute } from './docs/index.block';
export { examplesRoute } from './examples.block';
export { homeRoute } from './home.block';
export { appNavBlock } from './nav.block';
export { personFormBlock, routes as personFormRoutes } from './person-form.block';
