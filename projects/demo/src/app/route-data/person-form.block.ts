/**
 * Block description for the person form, passed as route data to BlockHost.
 * Refs use PersonForm.instance.FormState.* so child blocks (StringInput, NumberInput)
 * resolve against the root block's FormState, which receives the default model via setModel().
 */
const personFormBlock = {
  component: 'RowLayout',
  id: 'PersonForm',
  services: [{ id: 'FormState', scope: 'self' as const }],
  inputs: {
  
    rows: [
      { columns: [{ blockId: 'AppNav' }] },
      {
        columns: [
          {
            component: 'HtmlBlock',
            inputs: {
              model: '{{PersonForm.instance.FormState.model}}',
              html: 'hello  {{firstName}} {{PersonForm.instance.FormState.lastName}} {{age}}',
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
              value: '[(PersonForm.instance.FormState.firstName)]',
              placeholder: 'First name',
            },
          },
          {
            component: 'StringInput',
            inputs: {
              label: 'Last name',
              value: '[(PersonForm.instance.FormState.lastName)]',
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
              value: '[(PersonForm.instance.FormState.email)]',
              placeholder: 'email@example.com',
            },
          },
          {
            component: 'NumberInput',
            inputs: {
              label: 'Age',
              value: '{{PersonForm.instance.FormState.age}}',
              min: 0,
              max: 120,
            },
            outputs: {
              valueChange: {
                type: 'reference' as const,
                reference: 'PersonForm.instance.FormState.age',
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
        email: 'jane.doe@example.com',
        age: 28,
      },
      blockDefinitions: { PersonForm: personFormBlock },
    },
  } as const,
];
