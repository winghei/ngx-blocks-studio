/**
 * Block-directive use cases: full doc content as block rows.
 * Source: docs/block-directive-use-cases.md
 */

export const blockDirectiveUseCasesRows = [
  {
    columns: [
      {
        component: 'Section',
        inputs: {
          title: 'Block-directive use cases',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Quick reference for how block descriptions use <strong>bindings</strong>, <strong>services</strong>, directive inputs/outputs, <strong>block references</strong>, and <strong>output handlers</strong>. Each use case includes a short description and where it appears in the demo app.</p>',
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
          title: '1. Input bindings',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>1.1 Literal inputs</h4><p><strong>Description:</strong> Plain values (string, number, boolean, object, array) are set on the component (or host directive) as-is.</p><p><strong>Use case:</strong> Static labels, placeholders, config objects, row/column layout data.</p><p><strong>Demo:</strong> All blocks use literal <code>inputs</code> (e.g. <code>label: 'First name'</code>, <code>html: '&lt;h2&gt;Login&lt;/h2&gt;'</code>, <code>rows</code> arrays). Files: <code>route-data/person-form.block.ts</code>, <code>route-data/login.block.ts</code>, <code>route-data/nav.block.ts</code>.</p>",
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<h4>1.2 Read-only refs: <code>&#123;&#123; refPath &#125;&#125;</code></h4><p><strong>Description:</strong> A string containing <code>&#123;&#123; refPath &#125;&#125;</code> is interpolated: each placeholder is replaced with the value at that path. Ref path is either <strong>current block</strong> (<code>serviceOrModel.path</code>) or <strong>named block</strong> (<code>BlockID:serviceOrModel.path</code>, e.g. <code>PersonForm:FormState.firstName</code>). An effect keeps the value in sync when refs (e.g. signals) change.</p><p><strong>Use case:</strong> Display state from a service or another block without two-way binding.</p><p><strong>Demo:</strong> Person form HtmlBlock shows <code>&#123;&#123;PersonForm:FormState.nestedSignal.sub.a&#125;&#125;</code>, <code>&#123;&#123;PersonForm:FormState.lastName&#125;&#125;</code>. Dashboard shows <code>&#123;&#123;DashboardPage:DashboardState.note&#125;&#125;</code>.</p>',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>1.3 Two-way refs: <code>&#91;&#40; refPath &#41;&#93;</code></h4><p><strong>Description:</strong> The <strong>entire</strong> input value must be exactly <code>\"&#91;&#40;refPath&#41;&#93;\"</code>. The loader (1) sets the initial value from the ref, (2) syncs ref → component when the ref changes, (3) syncs component → ref when the component's signal/input changes. No mixing with literals or <code>&#123;&#123; &#125;&#125;</code>.</p><p><strong>Use case:</strong> Form controls bound to a shared state service (e.g. StringInput/NumberInput value bound to <code>FormState.firstName</code>, <code>FormState.age</code>).</p><p><strong>Demo:</strong> Person form and login/dashboard use <code>value: '&#91;&#40;PersonForm:FormState.firstName&#41;&#93;'</code>, <code>value: '&#91;&#40;LoginPage:AuthState.username&#41;&#93;'</code>, <code>value: '&#91;&#40;DashboardPage:DashboardState.note&#41;&#93;'</code>.</p>",
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
          title: 'Example: literal inputs on a StringInput block',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<pre class=\"p-2 bg-light border rounded\"><code>{\n  component: 'StringInput',\n  inputs: {\n    label: 'Literal label',\n    value: 'literal value',\n    placeholder: 'placeholder',\n  },\n}</code></pre>",
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Static HTML and literal <code>label</code> / <code>value</code> (no refs):</p>',
              },
            },
            {
              component: 'StringInput',
              inputs: {
                label: 'Literal label',
                value: 'literal value',
                placeholder: 'placeholder',
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
          title:
            'Example: read-only refs <code>&#123;&#123; refPath &#125;&#125;</code> on a HtmlBlock and FormsState service',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: `<pre class="p-2 bg-light border rounded" style="white-space: pre-wrap; word-break: break-all;"><code>{
  component: 'HtmlBlock',
  inputs: {
    html: 'Displaying state from the DocsPage FormState:&lt;br/&gt;' +
      '&lt;strong&gt;Current time:&lt;/strong&gt; &#123;&#123;DocsPage:FormState.time&#125;&#125;&lt;br/&gt;' +
      '&lt;strong&gt;First name:&lt;/strong&gt; &#123;&#123;DocsPage:FormState.firstName&#125;&#125; &amp;middot; ' +
      '&lt;strong&gt;Last name:&lt;/strong&gt; &#123;&#123;DocsPage:FormState.lastName&#125;&#125; &amp;middot; ' +
      '&lt;strong&gt;Age:&lt;/strong&gt; &#123;&#123;DocsPage:FormState.age&#125;&#125;',
  },
}</code></pre>`,
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Bound to DocsPage FormState — updates when state changes:</p>',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Displaying state from the DocsPage FormState:<br/><strong>Current time:</strong> {{DocsPage:FormState.time}}<br/><strong>First name:</strong> {{DocsPage:FormState.firstName}} · <strong>Last name:</strong> {{DocsPage:FormState.lastName}} · <strong>Age:</strong> {{DocsPage:FormState.age}}</p>',
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
          title: 'Example: two-way refs <code>&#91;&#40; &#41;&#93;</code>',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: `<pre class="p-2 bg-light border rounded" style="white-space: pre-wrap; word-break: break-all;"><code>{<br/>  component: &#39;StringInput&#39;,<br/>  inputs: {<br/>    label: &#39;First name&#39;,<br/>    value: '&#91;&#40;DocsPage:FormState.firstName&#41;&#93;',<br/>    placeholder: &#39;First name&#39;,<br/>  },<br/>}</code></pre>`,
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Edit these; the read-only line above stays in sync (same FormState):</p>',
              },
            },
            {
              component: 'StringInput',
              inputs: {
                label: 'First name',
                value: '[(DocsPage:FormState.firstName)]',
                placeholder: 'First name',
              },
            },
            {
              component: 'StringInput',
              inputs: {
                label: 'Last name',
                value: '[(DocsPage:FormState.lastName)]',
                placeholder: 'Last name',
              },
            },
            {
              component: 'NumberInput',
              inputs: {
                label: 'Age',
                value: '[(DocsPage:FormState.age)]',
                min: 0,
                max: 120,
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
          title: '2. Services',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>2.1 Root-scoped services</h4><p><strong>Description:</strong> <code>services: ['ServiceId']</code> or <code>services: [{ id: 'ServiceId', alias?: 'Alias' }]</code> (no <code>scope</code>). Resolved from the <strong>root injector</strong>. One instance per app. Refs like <code>BlockID:FormState.firstName</code> resolve.</p><p><strong>Use case:</strong> Shared app-wide state (e.g. auth, theme). Person form uses root <code>FormState</code> when not using <code>scope: 'self'</code>.</p><p><strong>Demo:</strong> Person form uses <code>services: [{ id: 'FormState' }]</code> (root).</p>",
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>2.2 Self-scoped services</h4><p><strong>Description:</strong> <code>services: [{ id: 'ServiceId', scope: 'self', alias?: 'Alias' }]</code>. A <strong>new instance</strong> is created per block via a child injector. Refs like <code>BlockID:ServiceId.prop</code> target this block's instance only.</p><p><strong>Use case:</strong> Per-page or per-form state (e.g. login has its own <code>AuthState</code>, dashboard its own <code>DashboardState</code>).</p><p><strong>Demo:</strong> Login: <code>services: [{ id: 'AuthState', scope: 'self' }]</code>. Dashboard: <code>services: [{ id: 'DashboardState', scope: 'self' }]</code>.</p>",
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>2.3 Model and setModel</h4><p><strong>Description:</strong> The block's <strong>model</strong> comes from the directive's <code>[model]</code> input or the <code>model</code> argument to <code>load()</code>. The loader sets <code>blockInstance['model']</code> and calls <code>setModel(model)</code> on every service that has that method (e.g. FormState, AuthState). If <code>[model]</code> is a <strong>ref path string</strong>, the loader binds to that ref's signal so model stays reactive.</p><p><strong>Use case:</strong> Passing route data or initial form data into state services.</p><p><strong>Demo:</strong> Route data passes <code>model: { firstName: 'Jane', ... }</code>; BlockHost passes it to the directive; FormState receives it via <code>setModel</code>.</p>",
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
          title: 'Example: services and model',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<p>This page block has <code>services: [{ id: 'FormState', scope: 'self' }]</code> and the route passes <code>model: { firstName: 'John', lastName: 'Doe', age: 30 }</code>. The read-only and two-way examples above use that same FormState; initial values come from <code>setModel</code>.</p>",
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
          title: '3. Host directives',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<p><strong>Registering directives:</strong> Register directive types in <strong>DirectiveRegistry</strong> by id. In the block description, set <code>directives: ['DirectiveId']</code>. The loader resolves these ids and passes them as <strong>host directives</strong> when creating the component. The same flat <code>inputs</code> and <code>outputs</code> are applied to the <strong>component and every host directive</strong> that has that key.</p><p><strong>Inputs/outputs on component and directives:</strong> For each key in <code>inputs</code> (or <code>outputs</code>), the loader finds <strong>all targets</strong> that have that key (component and host directive instances). It resolves the value once and <strong>sets it on every target</strong>. If a key exists only on a directive, only that directive receives it.</p>",
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: 'Example: MouseEvents directive on HTMLBlock',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<pre class="p-2 bg-light border rounded" style="white-space: pre-wrap; word-break: break-all;"><code>{<br/>  component: \'HtmlBlock\',<br/>  directives: [\'MouseEvents\'],<br/>  inputs: {<br/>    html: \'&lt;b&gt;&lt;i&gt;Click ME and check the console&lt;/i&gt;&lt;/b&gt;\',<br/>  },<br/>  outputs: {<br/>    clicked: {<br/>      type: \'reference\',<br/>      reference: \'DocsPage:FormState\',<br/>      method: \'alert\',<br/>      params: [\'Alert from clicked event\'],<br/>    },<br/>  },<br/>}</code></pre>',
              },
            },
            {
              component: 'HtmlBlock',
              directives: ['MouseEvents'],
              inputs: {
                html: '<b><i>Click ME and check the console</i></b>',
              },
              outputs: {
                clicked: {
                  type: 'reference',
                  reference: 'DocsPage:FormState',
                  method: 'alert',
                  params: ['Alert from clicked event'],
                },
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
          title: '4. Block references',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>4.1 Reuse by blockId (no overrides)</h4><p>Instead of a full description, pass <code>{ blockId: 'X' }</code>. The loader looks up the definition for <code>X</code> in <code>blockDefinitions</code> or the global <strong>BlockDefinitionsRegistry</strong>. Same block, same definition every time.</p><p><strong>Demo:</strong> Routes use <code>block: { blockId: 'PersonForm' }</code>, <code>block: { blockId: 'AppNav' }</code> in rows.</p>",
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>4.2 Reuse with overrides: blockDefinition</h4><p>Pass <code>{ blockId: 'X', blockDefinition: { inputs: { ... } } }</code>. The loader resolves the base definition for <code>X</code>, then <strong>deep-merges</strong> <code>blockDefinition</code> on top. Only the keys you specify are changed. <strong>Note:</strong> <code>inputs.model</code> in the description is ignored; pass model via <code>[model]</code> or <code>load(..., model, ...)</code>.</p>",
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
          title: 'Example: full description vs blockId reference',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<p><strong>Left:</strong> inline full block (no blockId). <strong>Right:</strong> <code>{ blockId: 'AppNav' }</code> — same nav as at top of page.</p>",
              },
            },
            {
              component: 'RowLayout',
              inputs: {
                rows: [
                  {
                    columns: [
                      {
                        component: 'HtmlBlock',
                        inputs: {
                          html: "<p class=\"p-2 border rounded\">This paragraph is rendered from an <strong>inline full block description</strong>: <code>{ component: 'HtmlBlock', inputs: { html: '...' } }</code>. No registry lookup.</p>",
                        },
                      },
                      {
                        component: 'Section',
                        inputs: {
                          title: 'Reused block (blockId)',
                          children: [{ blockId: 'AppNav' }],
                        },
                      },
                    ],
                  },
                ],
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
          title: '5. Output handlers',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>5.1 Output as reference</h4><p>In <code>outputs</code>, set the value to <code>{ type: 'reference', reference: 'RefPath', method: 'methodName', params?: [...] }</code>. When the output fires, the loader resolves <code>reference</code>, calls <code>method</code> on that target with <code>params</code> (or the emitted value if no params). Ref path can point to a service or a signal (e.g. <code>PersonForm:FormState.age</code> → signal's <code>set</code>).</p><p><strong>Demo:</strong> Person form NumberInput uses <code>valueChange: { type: 'reference', reference: 'FormState', method: 'alert', params: ['Age changed to &#123;&#123;value&#125;&#125;'] }</code> and <code>valueChange: { type: 'reference', reference: 'PersonForm:FormState.age', method: 'set' }</code>.</p>",
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<h4>5.2 then / onSuccess / onError</h4><p>When the method returns a <strong>Promise</strong>, you can add <code>then</code> (array of <code>{ reference, method, params? }</code>) or <code>onSuccess</code> / <code>onError</code>. These are invoked after the promise resolves or rejects.</p><h4>5.3 outputHandlers</h4><p>If the output value is <strong>not</strong> a reference config, the loader uses the <strong>outputHandlers</strong> map passed to the directive (key = output name). If no handler is provided, it uses a no-op.</p>',
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
          title: 'Example: output as reference',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<p>Change age; <code>value</code> calls <code>DocsPage:FormState.alert('Age changed')</code> (see console):</p>",
              },
            },
            {
              component: 'NumberInput',
              inputs: {
                label: 'Age (triggers alert on change)',
                value: '[(DocsPage:FormState.age)]',
                min: 0,
                max: 120,
              },
              outputs: {
                value: {
                  type: 'reference' as const,
                  reference: 'DocsPage:FormState',
                  method: 'alert',
                  params: ['Age changed'],
                },
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
          title: '6. Ref path format',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<table class="table table-bordered"><thead><tr><th>Form</th><th>Meaning</th><th>Example</th></tr></thead><tbody><tr><td><code>serviceOrModel.path</code></td><td>Current block\'s instance and path</td><td><code>FormState.firstName</code>, <code>model.age</code></td></tr><tr><td><code>BlockID:serviceOrModel.path</code></td><td>Named block\'s instance and path (block must have <code>id</code>)</td><td><code>PersonForm:FormState.firstName</code>, <code>LoginPage:AuthState.username</code></td></tr></tbody></table><p>Single segment (e.g. <code>FormState</code>) resolves to the instance; with path (e.g. <code>FormState.firstName</code>) the last segment is the property (or signal) on the resolved target.</p>',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>Live:</strong> <code>DocsPage:FormState.firstName</code> → {{DocsPage:FormState.firstName}} · <code>DocsPage:FormState.age</code> → {{DocsPage:FormState.age}}</p>',
              },
            },
          ],
        },
      },
    ],
  },
];
