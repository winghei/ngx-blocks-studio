/**
 * Documentation page: full doc content as blocks (no link-only sections).
 * Composes content from docs/ README, block-directive-use-cases, registry, block-loader, router-loader.
 */
import { blockLoaderRows } from './content/block-loader.content';
import { docsIntroRows } from './content/intro.content';
import { registryRows } from './content/registry.content';

const docsContentRows = [
  { columns: [{ blockId: 'AppNav' }] },
  ...docsIntroRows,

  ...registryRows,
  ...blockLoaderRows,
];

const docsBlock = {
  component: 'RowLayout',
  id: 'DocsPage',
  services: [{ id: 'FormState', scope: 'self' as const }],
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
