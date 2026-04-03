/** Single row to prepend to any page's rows so the header nav is rendered. */
const navRow = {
  columns: [
    {
      component: 'BlockFor',
      inputs: {
        class: ['app-nav'],
        items: ['home', 'docs', 'examples'].map((path) => ({
          id: path,
          path: `/${path}`,
          label: path,
        })),
        block: {
          component: 'LinkBlock',
          inputs: {
            label: '{{label}}',
            routerLink: '{{path}}',
            class: ['app-nav-link'],
          },
        },
        trackBy: 'id',
      },
    },
  ],
};

/** Full block template for the app nav (RowLayout + HtmlBlock). Register as 'AppNav' for { blockId: 'AppNav' } reference. */
export const appNavBlock = {
  component: 'RowLayout',

  inputs: {
    rows: [navRow],
  },
};
