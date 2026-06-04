import type { Config } from '@master/css';

/**
 * Master CSS v2 RC — demo design tokens + reusable component classes.
 * @see https://rc.css.master.co/guide/configuration
 */
const config: Config = {
  variables: {
    color: {
      primary: '#1565c0',
      surface: '#ffffff',
      canvas: '#fafafa',
      border: '#e0e0e0',
      muted: '#555555',
      darker: '#111111',
      hover: 'rgba(0, 0, 0, 0.06)',
      active: 'rgba(21, 101, 192, 0.08)',
    },
  },
  utilities: {
    'no-underline': { 'text-decoration': 'none' },
  },
  components: {
    'block-host': 'max-w:screen-md mx:auto py:8x px:6x bg:surface r:xl b:1|solid|border', // Added pipe to border
    'block-host-empty': 'py:8x fg:muted text:center',
    'html-block-content': 'fg:darker line-height:md font:md',
    'section-block': 'p:4x b:1|solid|border r:lg bg:canvas', // Re-verified
    'section-title': 'm:0 mb:1x font:lg f:semibold fg:darker',
    'section-content': 'flex flex:column gap:3x',
    'row-layout-row': 'flex flex:wrap gap:5x mb:5x mb:0:last',
    'row-layout-col': 'flex:1 min-w:0',
    'string-input-block': 'flex flex:column gap:1x',
    'string-input-label': 'font:sm f:medium fg:muted',
    'string-input-field': 'p:2x font:md b:1|solid|border r:md bg:surface',
    'number-input-block': 'flex flex:column gap:1x',
    'number-input-label': 'font:sm f:medium fg:muted',
    'number-input-field': 'p:2x font:md b:1|solid|border r:md bg:surface',
    'link-block': 'cursor:pointer text-decoration:underline opacity:0.8:hover',
    'app-nav': 'flex gap:1x px:6x min-h:12x ai:center bg:surface bb:1|solid|border',
    'app-nav-link':
      'p:4x fg:muted text-decoration:none font:md f:medium r:md fg:darker bg:hover:hover',
    /** Applied by RouterLinkActive when the link’s route is active. */
    'demo-link-active': 'fg:primary bg:active f:semibold',
  },
};

export default config;
