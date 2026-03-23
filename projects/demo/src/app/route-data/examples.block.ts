import { blockDirectiveUseCasesRows } from './docs/content/block-directive-use-cases.content';

export const examplesRoute = {
  path: 'examples',
  component: 'BlockHost',
  title: 'Block examples',
  data: {
    block: {
       blockId: 'ExamplePage',
    },
    model: { firstName: 'Demo', lastName: 'User', email: 'demo@example.com', age: 25 },
  },
} as const;


export const ExamplePageBlock = {
  component: 'RowLayout',
  id: 'ExamplePage',
  services: [{ id: 'FormState', scope: 'self' as const }],
  inputs: {
    rows: [{ columns: [{ blockId: 'AppNav' }] }, ...blockDirectiveUseCasesRows],
  },
} as const;
