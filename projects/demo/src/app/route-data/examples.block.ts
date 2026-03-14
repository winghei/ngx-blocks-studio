/**
 * Block examples page: showcases Section, literal inputs, read-only {{ }}, two-way [( )],
 * output reference, and block reference (AppNav). Uses FormState (self-scoped) for bindings.
 */
const examplesBlock = {
  component: 'RowLayout',
  id: 'ExamplesPage',
  services: [{ id: 'FormState', scope: 'self' as const }],
  inputs: {
    rows: [
      { columns: [{ blockId: 'AppNav' }] },
      {
        columns: [
          {
            component: 'Section',
            inputs: {
              title: 'Literals',
              children: [
                {
                  component: 'HtmlBlock',
                  inputs: {
                    html: '<p>Static HTML and literal values (no refs).</p>',
                  },
                },
              ],
            },
          },
        ],
      },
      {
        columns: [
          {
            component: 'Section',
            inputs: {
              title: 'Read-only refs ({{ refPath }})',
              children: [
                {
                  component: 'HtmlBlock',
                  inputs: {
                    html: 'Name: {{ExamplesPage:FormState.firstName}} {{ExamplesPage:FormState.lastName}} · Age: {{ExamplesPage:FormState.age}}',
                  },
                },
              ],
            },
          },
        ],
      },
      {
        columns: [
          {
            component: 'Section',
            inputs: {
              title: 'Two-way binding ( [ ( refPath ) ] )',
              children: [
                {
                  component: 'StringInput',
                  inputs: {
                    label: 'First name',
                    value: '[(ExamplesPage:FormState.firstName)]',
                    placeholder: 'Type here',
                  },
                },
                {
                  component: 'NumberInput',
                  inputs: {
                    label: 'Age',
                    value: '[(ExamplesPage:FormState.age)]',
                    min: 0,
                    max: 120,
                  },
                  outputs: {
                    valueChange: {
                      type: 'reference' as const,
                      reference: 'ExamplesPage:FormState.age',
                      method: 'set',
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  },
};

export { examplesBlock };

export const examplesRoute = {
  path: 'examples',
  component: 'BlockHost',
  title: 'Block examples',
  data: {
    block: { blockId: 'ExamplesPage' },
    blockDefinitions: { ExamplesPage: examplesBlock },
    model: { firstName: 'Demo', lastName: 'User', email: 'demo@example.com', age: 25 },
  },
} as const;
