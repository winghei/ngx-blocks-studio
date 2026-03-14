/**
 * Documentation page: full doc content as blocks (no link-only sections).
 * Composes content from docs/ README, block-directive-use-cases, registry, block-loader, router-loader.
 */
import { docsIntroRows } from './content/intro.content';
import { blockDirectiveUseCasesRows } from './content/block-directive-use-cases.content';
import { registryRows } from './content/registry.content';
import { blockLoaderRows } from './content/block-loader.content';
import { routerLoaderRows } from './content/router-loader.content';

const docsContentRows = [
  { columns: [{ blockId: 'AppNav' }] },
  ...docsIntroRows,

  ...registryRows,
  ...blockLoaderRows,
  ...blockDirectiveUseCasesRows,
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
    model: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      age: 30,
    },
  },
} as const;



