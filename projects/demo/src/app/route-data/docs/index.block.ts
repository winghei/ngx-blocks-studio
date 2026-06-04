/**
 * Documentation page: full doc content as blocks (no link-only sections).
 * Composes content from docs/ README, registry, block-loader, router-loader.
 * (Interactive block-directive use cases live on the Examples route — they reference `ExamplePage`.)
 */
import { blockLoaderRows } from './content/block-loader.content';
import { docsIntroRows } from './content/intro.content';
import { registryRows } from './content/registry.content';
import { routerLoaderRows } from './content/router-loader.content';

const docsContentRows = [
  { columns: [{ blockId: 'AppNav' }] },
  ...docsIntroRows,
  ...registryRows,
  ...blockLoaderRows,
  ...routerLoaderRows,
];

const docsBlock = {
  component: 'RowLayout',
  id: 'DocsPage',
  services: [{ id: 'GeneralModelService', alias: 'FormState', scope: 'self' as const }],
  inputs: {
    rows: docsContentRows,
  },
};

export { docsBlock };

export const docsRoute = {
  path: 'docs',
  component: 'BlockHost',
  title: 'Documentation',
  data: {
    block: docsBlock,
  },
} as const;
