/**
 * Route loader doc content as block rows.
 * Source: docs/core/router-loader.md
 */

export const routerLoaderRows = [
  {
    columns: [
      {
        component: 'Section',
        inputs: {
          title: 'Route loader',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Loads route configuration from a JSON file (or URL), resolves <strong>components</strong> and <strong>guards</strong> by name via ComponentRegistry and GuardRegistry, and applies the resulting Angular <code>Routes</code> to the router. All route config is exposed as <strong>signals</strong>.</p><p><strong>Source:</strong> <code>projects/blocks-studio/src/lib/core/services/router-loader.service.ts</code></p>',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>Example:</strong> This app calls <code>routeLoader.loadRoutes({ routes, defaultRedirect, catchAllRedirect })</code> in <code>app.config.ts</code>. The <code>docs</code> route you are on is one entry in <code>routes</code>. Each route has <code>path</code>, <code>component: \'BlockHost\'</code> (resolved via ComponentRegistry), <code>title</code>, and <code>data: { block, model?, blockDefinitions? }</code>. The nav links above are the same routes loaded by RouteLoader.</p>',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<pre class="p-2 bg-light border rounded mb-0"><code>// Minimal route shape (this docs route):\n{\n  path: \'docs\',\n  component: \'BlockHost\',\n  title: \'Documentation\',\n  data: { block: docsBlock, model: { ... } }\n}</code></pre>',
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
          title: 'Overview',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>RouteLoader</strong> – Injectable service that fetches a route config file (or accepts a config object), converts each entry into an Angular <code>Route</code> (with lazy-loaded components and resolved guards), and calls <code>Router.resetConfig(routes)</code>.</p><p><strong>RouteConfig</strong> – Per-route: <code>path</code>, <code>component</code> (key), <code>title?</code>, <code>canActivate?</code>, <code>canDeactivate?</code>, <code>canLoad?</code>, <code>canMatch?</code>, <code>canActivateChild?</code>, <code>outlet?</code>, <code>pathMatch?</code>, <code>runGuardsAndResolvers?</code>, <code>data?</code>, <code>children?</code> (RouteConfigs).</p><p><strong>RouteConfigs</strong> – <code>routes</code> array plus optional <code>defaultRedirect</code> (empty path) and <code>catchAllRedirect</code> (unknown routes). Same shape for top-level and for each route\'s <code>children</code>.</p>',
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
          title: 'RouteLoader API',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<ul><li><code>loadRoutes(config)</code> – Loads the given config object, updates signals, resets the router. Use for in-memory config.</li><li><code>loadRoutesFromUrl(configPath)</code> – Fetches config from URL (HTTP GET), then loads it. Sets <code>configPath</code> signal.</li><li><code>routeConfigFile</code> – Signal of currently loaded config or <code>null</code>.</li><li><code>configPath</code> – Signal of URL from which config was loaded (set only by <code>loadRoutesFromUrl</code>).</li><li><code>routeConfig</code> – Computed signal: <code>routeConfigFile()?.routes ?? []</code>.</li></ul>',
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
          title: 'Usage',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>1. Register components and guards</strong> (before loading routes) with ComponentRegistry and GuardRegistry.</p><p><strong>2. Load routes</strong> – from a config object or from a URL:</p><pre class="mb-0"><code>await this.routeLoader.loadRoutes(myRouteConfigs);\n// or\nawait this.routeLoader.loadRoutesFromUrl(\'/assets/routes.json\');</code></pre><p><strong>3. Read config reactively:</strong> <code>routeLoader.routeConfigFile()</code>, <code>routeLoader.routeConfig()</code>, <code>routeLoader.configPath()</code>.</p><p><strong>Errors:</strong> If a route\'s <code>component</code> is not registered, <code>loadComponent</code> throws when that route is first loaded. Unknown guard keys log a warning and that guard is omitted.</p>',
              },
            },
          ],
        },
      },
    ],
  },
];
