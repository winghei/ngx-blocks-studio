/**
 * Nav block: RowLayout with a single row containing an HtmlBlock (no new component).
 * Use navRow as the first row on every page so the header nav is shown.
 * Skin classes (e.g. .app-nav) live in app/skin/.
 */
const NAV_HTML = `
<nav class="app-nav">
  <a href="/">Person info</a>
  <a href="/login">Login</a>
  <a href="/dashboard">Dashboard</a>
</nav>
`.trim();

/** Single row to prepend to any page's rows so the header nav is rendered. */
const navRow = {
  columns: [
    {
      component: 'HtmlBlock',
      inputs: { html: NAV_HTML },
    },
  ],
};

/** Full block template for the app nav (RowLayout + HtmlBlock). Register as 'AppNav' for { blockId: 'AppNav' } reference. */
export const appNavBlock = {
  component: 'RowLayout',
  id: 'AppNav',
  inputs: {
    rows: [navRow],
  },
};
