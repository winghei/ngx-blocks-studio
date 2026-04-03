/**
 * Documentation intro and structure (from docs/README.md).
 */

export const docsIntroRows = [
  {
    columns: [
      {
        component: 'HtmlBlock',
        inputs: {
          html: '<h1>Documentation</h1><p class="lead">Central documentation for <strong>ngx-blocks-studio</strong>. All module and API docs are rendered below as blocks — no external links, full content in-app.</p>',
        },
      },
    ],
  },
  {
    columns: [
      {
        component: 'Section',
        inputs: {
          title: 'Structure',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Repo <code>docs/</code> folder:</p><pre class="mb-0"><code>docs/\n├── README.md\n├── block-directive-use-cases.md\n└── core/\n    ├── registry.md\n    ├── block-loader.md\n    └── router-loader.md</code></pre>',
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
          title: 'Contents (in this page)',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<ul><li><strong>Registry</strong> – ComponentRegistry, DirectiveRegistry, GuardRegistry, ServiceRegistry, RegistryMetadataStore, lazy loading.</li><li><strong>Block loader</strong> – BlockDirective, description shape, inputs (literal, <code>&#123;&#123; &#125;&#125;</code>, <code>&#91;&#40; &#41;&#93;</code>), host directives, outputs as callable refs, reusing blocks by <code>blockId</code>.</li><li><strong>Route loader</strong> – RouteLoader, RouteConfig, loading routes from JSON or in-memory config.</li></ul><p><strong>Examples</strong> (app route <code>/examples</code>): interactive block-directive use cases — bindings, services, host directives, block references, and output handlers — with live <code>ExamplePage</code> refs.</p><p>Library source: <code>projects/blocks-studio/src/lib/</code>.</p>',
              },
            },
          ],
        },
      },
    ],
  },
];
