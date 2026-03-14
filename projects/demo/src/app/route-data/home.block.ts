/**
 * Home page: short landing that links to Documentation and app pages.
 * Full documentation content lives under the /docs route (route-data/docs/).
 */
const homeBlock = {
  component: 'RowLayout',
  id: 'HomePage',
  inputs: {
    rows: [
      { columns: [{ blockId: 'AppNav' }] },
      {
        columns: [
          {
            component: 'HtmlBlock',
            inputs: {
              html: '<h1>ngx-blocks-studio</h1><p class="lead">Compose UIs from declarative block definitions from JSON.</p><p>This demo is built entirely from <strong>blocks</strong>. Read the full docs or explore the app via the nav above.</p>',
            },
          },
        ],
      },
      {
        columns: [
          {
            component: 'Section',
            inputs: {
              title: 'Quick links',
              children: [
                {
                  component: 'LinkBlock',
                  inputs: { label: 'Documentation', routerLink: '/docs' },
                },

                {
                  component: 'LinkBlock',
                  inputs: { label: 'Block examples', routerLink: '/examples' },
                },
              ],
            },
          },
        ],
      },
    ],
  },
};

export { homeBlock };

export const homeRoute = {
  path: 'home',
  component: 'BlockHost',
  title: 'Home',
  data: {
    block: homeBlock,
  },
} as const;
