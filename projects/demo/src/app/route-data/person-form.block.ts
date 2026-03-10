/**
 * Block description for the person form, passed as route data to BlockHost.
 * Refs use PersonForm:FormState.* so child blocks (StringInput, NumberInput)
 * resolve against the root block's FormState, which receives the default model via setModel().
 */
const personFormBlock = {
  component: 'RowLayout',
  id: 'PersonForm',
  services: [{ id: 'FormState' }],

  inputs: {
    rows: [
      { columns: [{ blockId: 'AppNav' }] },
      {
        columns: [
          {
            component: 'HtmlBlock',
            model: { firstName: 'John', items: { a: 1, b: 2, sub: { a: 134, b: 2 } }, lastName: 'Doe', age: 30 },
            inputs: {
              html: 'hello  {{items.a}} {{items.sub.a}} {{PersonForm:FormState.nestedSignal.sub.a}} {{PersonForm:FormState.lastName}} {{age}}',
            },
          },
        ],
      },
      {
        columns: [
          {
            component: 'StringInput',
            inputs: {
              label: 'First name',
              value: '[(PersonForm:FormState.firstName)]',
              placeholder: 'First name',
            },
          },
          {
            component: 'StringInput',
            inputs: {
              label: 'Last name',
              value: '[(PersonForm:FormState.lastName)]',
              placeholder: 'Last name',
            },
          },
        ],
      },
      {
        columns: [
          {
            component: 'StringInput',
            inputs: {
              label: 'Email',
              value: '[(PersonForm:FormState.email)]',
              placeholder: 'email@example.com',
            },
          },
          {
            component: 'NumberInput',
            inputs: {
              label: 'Age',
              value: '{{PersonForm:FormState.age}}',
              min: 0,
              max: 120,
            },
            outputs: {
              valueChange: {
                type: 'reference' as const,
                reference: 'PersonForm:FormState.age',
                method: 'set',
              },
            },
          },
        ],
      },
    ],
  },
};

export { personFormBlock };

export const routes = [
  {
    path: '',
    component: 'BlockHost',
    title: 'Person info',
    data: {
      // Reuse by blockId; optional blockDefinition deep-merges overrides (e.g. inputs.model only).
      // Example with override: block: { blockId: 'PersonForm', blockDefinition: { inputs: { model: {...} } } }
      block: { blockId: 'PersonForm', id: 'PersonForm' },
      model: {
        firstName: 'Jane',
        lastName: 'Doe',
        items: { a: 'asdf', sub: { a: 134, b: 2 } },
        email: 'jane.doe@example.com',
        age: 28,
      },
      blockDefinitions: { PersonForm: personFormBlock },
    },
  } as const,
];
