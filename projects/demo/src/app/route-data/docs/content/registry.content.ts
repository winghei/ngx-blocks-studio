/**
 * Registry doc content as block rows.
 * Source: docs/core/registry.md
 */

export const registryRows = [
  {
    columns: [
      {
        component: 'Section',
        inputs: {
          title: 'Registry',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>The registry module provides a unified system for registering and resolving Angular <strong>components</strong>, <strong>directives</strong>, <strong>services</strong>, and <strong>guards</strong> by name, with optional <strong>metadata</strong> and <strong>lazy loading</strong>. Metadata is stored in a single shared store.</p><p><strong>Source:</strong> <code>projects/blocks-studio/src/lib/core/registry/</code></p>',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>Example:</strong> This page is rendered by components resolved via ComponentRegistry: <code>RowLayout</code>, <code>Section</code>, <code>HtmlBlock</code>, <code>StringInput</code>, <code>NumberInput</code>, <code>LinkBlock</code>. The block below is created from a <strong>full description</strong> (component + inputs); the loader resolves <code>\'HtmlBlock\'</code> through the registry to render it.</p>',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p class="p-2 bg-light border rounded">Rendered via <code>ComponentRegistry.get(\'HtmlBlock\')</code> from description <code>{ component: \'HtmlBlock\', inputs: { html: \'...\' } }</code>.</p>',
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
                html: '<ul><li><strong>ComponentRegistry</strong> – Register Angular component types (or loaders) by name; resolve by name with optional lazy loading.</li><li><strong>DirectiveRegistry</strong> – Register directive types by name; used by the block loader for <strong>host directives</strong>.</li><li><strong>GuardRegistry</strong> – Register route guards (or loaders) by name; resolve by name.</li><li><strong>ServiceRegistry</strong> – Register service types by name; resolve <strong>instances</strong> via the Angular injector. You must call <code>setInjector(injector)</code> before using <code>get()</code>.</li><li><strong>RegistryMetadataStore</strong> – Single source of truth for metadata for all registries; <code>getMetadata(key)</code>, <code>getAllMetadata()</code>.</li></ul><p>All five are singletons. Component, directive, guard, and service registries delegate metadata to <code>RegistryMetadataStore</code>.</p>',
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
          title: 'ComponentRegistry API',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><code>getInstance()</code> · <code>register(name, component, metadata?)</code> · <code>get(name)</code> (async; runs loader if needed) · <code>getSync(name)</code> · <code>has(name)</code> · <code>getAll()</code> · <code>getMetadata(key)</code> · <code>unregister(name)</code> · <code>clear()</code>.</p><p>You can register a <strong>loader</strong> instead of a type: <code>() => import(\'./heavy-chart.component\').then(m => m.HeavyChartComponent)</code>. The first time <code>get(\'heavy-chart\')</code> is called, the loader runs and the result is cached.</p>',
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
          title: 'DirectiveRegistry',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Same API pattern as ComponentRegistry. Used by the block loader when a block description includes <code>directives</code>: those directive types are applied as host directives on the dynamically created component, and the same flat <code>inputs</code>/<code>outputs</code> are resolved and set on the component and/or those directives.</p>',
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
          title: 'ServiceRegistry',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>setInjector(injector)</strong> is required before <code>get()</code> / <code>getSync()</code>. <code>register(name, service, metadata?)</code> · <code>get(name)</code> returns the <strong>instance</strong> (async; runs loader if needed) · <code>getSync(name)</code> · <code>has(name)</code> · <code>getAllNames()</code> · <code>getMetadata(key)</code> · <code>unregister(name)</code> · <code>clear()</code>.</p><p>You can register a loader; the first time <code>get(\'analytics\')</code> is called, the loader runs and the resolved type is used to get an instance from the injector.</p>',
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
          title: 'GuardRegistry',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Registers route guards (functional or class-based) or loader functions by name. Used when resolving guards by string key (e.g. for RouteLoader from route config <code>guards: [\'auth\']</code>). API: <code>register(name, guard, metadata?)</code> · <code>get(name)</code> · <code>getSync(name)</code> · <code>has(name)</code> · <code>getMetadata(key)</code> · <code>getAllWithMetadata()</code> · <code>unregister(name)</code> · <code>clear()</code>.</p>',
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
          title: 'RegistryMetadataStore',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><code>getInstance()</code> · <code>set(key, type, data)</code> · <code>get(key)</code> / <code>getMetadata(key)</code> · <code>getByType(type)</code> · <code>getAllMetadata()</code> returns <code>{ components, directives, services, guards }</code> (Maps) · <code>has(key)</code> · <code>remove(key)</code> · <code>clear()</code>.</p>',
              },
            },
          ],
        },
      },
    ],
  },
];
