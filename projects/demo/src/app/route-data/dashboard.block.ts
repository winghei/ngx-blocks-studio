/**
 * Block template for dummy dashboard page with a simple form. Layout + basic blocks; state in DashboardState service.
 */
const dashboardBlock = {
  component: 'RowLayout',
  id: 'DashboardPage',
  services: [{ id: 'DashboardState', scope: 'self' as const }],
  inputs: {
    model: { note: '' },
    rows: [
      { columns: [{ blockId: 'AppNav' }] },
      {
        columns: [
          {
            component: 'HtmlBlock',
            inputs: { html: '<h2>Dashboard</h2>' },
          },
        ],
      },
      {
        columns: [
          {
            component: 'HtmlBlock',
            inputs: {
              html: 'Note: {{DashboardPage:DashboardState.note}}',
            },
          },
        ],
      },
      {
        columns: [
          {
            component: 'StringInput',
            inputs: {
              label: 'Note',
              value: '[(DashboardPage:DashboardState.note)]',
              placeholder: 'Enter a note',
            },
          },
        ],
      },
    ],
  },
};

export { dashboardBlock };

export const dashboardRoute = {
  path: 'dashboard',
  component: 'BlockHost',
  title: 'Dashboard',
  data: {
    block: { blockId: 'DashboardPage' },
    blockDefinitions: { DashboardPage: dashboardBlock },
  },
} as const;
