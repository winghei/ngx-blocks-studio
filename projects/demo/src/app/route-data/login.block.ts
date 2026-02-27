/**
 * Block template for dummy login page. Layout + basic blocks only; state in AuthState service.
 */
const loginBlock = {
  component: 'RowLayout',
  id: 'LoginPage',
  services: [{ id: 'AuthState', scope: 'self' as const }],
  inputs: {
    model: { username: '', password: '' },
    rows: [
      { columns: [{ blockId: 'AppNav' }] },
      {
        columns: [
          {
            component: 'HtmlBlock',
            inputs: { html: '<h2>Login</h2>' },
          },
        ],
      },
      {
        columns: [
          {
            component: 'StringInput',
            inputs: {
              label: 'Username',
              value: '[(LoginPage.instance.AuthState.username)]',
              placeholder: 'Username',
            },
          },
        ],
      },
      {
        columns: [
          {
            component: 'StringInput',
            inputs: {
              label: 'Password',
              value: '[(LoginPage.instance.AuthState.password)]',
              placeholder: 'Password',
            },
          },
        ],
      },
      {
        columns: [
          {
            component: 'HtmlBlock',
            inputs: { html: '<p>Submit (dummy)</p>' },
          },
        ],
      },
    ],
  },
};

export { loginBlock };

export const loginRoute = {
  path: 'login',
  component: 'BlockHost',
  title: 'Login',
  data: {
    block: { blockId: 'LoginPage' },
    blockDefinitions: { LoginPage: loginBlock },
  },
} as const;
