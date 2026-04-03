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
                html: '<h4>1.2 Read-only refs: <code>&#123;&#123; refPath &#125;&#125;</code></h4><p><strong>Description:</strong> A string containing <code>&#123;&#123; refPath &#125;&#125;</code> is interpolated: each placeholder is replaced with the value at that path. Ref path is either <strong>current block</strong> (<code>serviceOrModel.path</code> or <code>model.path</code>) or <strong>named block</strong> (<code>BlockID:serviceOrModel.path</code>, e.g. <code>PersonForm:FormState.firstName</code>). A <strong>computed</strong> keeps the value in sync when refs (e.g. signals) change.</p><p><strong>Use case:</strong> Display state from a service, the current block model, or another block without two-way binding.</p><p><strong>Demo:</strong> Person form HtmlBlock shows <code>&#123;&#123;PersonForm:FormState.nestedSignal.sub.a&#125;&#125;</code>, <code>&#123;&#123;PersonForm:FormState.lastName&#125;&#125;</code>. Dashboard shows <code>&#123;&#123;DashboardPage:DashboardState.note&#125;&#125;</code>.</p>',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>1.3 Two-way refs: <code>&#91;&#40; refPath &#41;&#93;</code></h4><p><strong>Description:</strong> The <strong>entire</strong> input value must be exactly <code>\"&#91;&#40;refPath&#41;&#93;\"</code>. The loader wires Angular <strong>twoWayBinding</strong>: initial value from the ref, then ref ↔ component stay in sync. No mixing with literals or <code>&#123;&#123; &#125;&#125;</code> in the same string. If the target is not a writable signal, the loader may fall back to read-only and warn.</p><p><strong>Use case:</strong> Form controls bound to shared state (e.g. StringInput/NumberInput <code>value</code> to <code>FormState.firstName</code>, <code>FormState.age</code>).</p><p><strong>Demo:</strong> Person form and login/dashboard use <code>value: '&#91;&#40;PersonForm:FormState.firstName&#41;&#93;'</code>, <code>value: '&#91;&#40;LoginPage:AuthState.username&#41;&#93;'</code>, <code>value: '&#91;&#40;DashboardPage:DashboardState.note&#41;&#93;'</code>.</p>",
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
                html: "<pre class=\"doc-snippet\"><code>{\n  component: 'StringInput',\n  inputs: {\n    label: 'Literal label',\n    value: 'literal value',\n    placeholder: 'placeholder',\n  },\n}</code></pre>",
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
            'Example: read-only refs <code>&#123;&#123; refPath &#125;&#125;</code> on a HtmlBlock and FormState service',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: `<pre class="doc-snippet" style="white-space: pre-wrap; word-break: break-all;"><code>{
  component: 'HtmlBlock',
  inputs: {
    html: 'Displaying state from the ExamplePage FormState:&lt;br/&gt;' +
      '&lt;strong&gt;Current time:&lt;/strong&gt; &#123;&#123;ExamplePage:FormState.time&#125;&#125;&lt;br/&gt;' +
      '&lt;strong&gt;First name:&lt;/strong&gt; &#123;&#123;ExamplePage:FormState.firstName&#125;&#125; &amp;middot; ' +
      '&lt;strong&gt;Last name:&lt;/strong&gt; &#123;&#123;ExamplePage:FormState.lastName&#125;&#125; &amp;middot; ' +
      '&lt;strong&gt;Age:&lt;/strong&gt; &#123;&#123;ExamplePage:FormState.age&#125;&#125;',
  },
}</code></pre>`,
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Bound to ExamplePage FormState — updates when state changes:</p>',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Displaying state from the ExamplePage FormState:<br/><strong>Current time:</strong> {{ExamplePage:FormState.time}}<br/><strong>First name:</strong> {{ExamplePage:FormState.firstName}} · <strong>Last name:</strong> {{ExamplePage:FormState.lastName}} · <strong>Age:</strong> {{ExamplePage:FormState.age}}</p>',
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
                html: `<pre class="doc-snippet" style="white-space: pre-wrap; word-break: break-all;"><code>{<br/>  component: &#39;StringInput&#39;,<br/>  inputs: {<br/>    label: &#39;First name&#39;,<br/>    value: '&#91;&#40;ExamplePage:FormState.firstName&#41;&#93;',<br/>    placeholder: &#39;First name&#39;,<br/>  },<br/>}</code></pre>`,
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
                value: '[(ExamplePage:FormState.firstName)]',
                placeholder: 'First name',
              },
            },
            {
              component: 'StringInput',

              inputs: {
                label: 'Last name',
                value: '[(ExamplePage:FormState.lastName)]',
                placeholder: 'Last name',
              },
            },
            {
              component: 'NumberInput',
              inputs: {
                label: 'Age',
                value: '[(ExamplePage:FormState.age)]',
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
          title: '2. Services and scope',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>2.1 Root-scoped services</h4><p><strong>Description:</strong> <code>services: ['ServiceId']</code> or <code>services: [{ id: 'ServiceId', alias?: 'Alias' }]</code> (no <code>scope</code>). These are resolved from the <strong>Angular injector</strong> (for example services with <code>providedIn: 'root'</code>) using <code>viewContainerRef.injector.get(...)</code>. If Angular returns an instance, that instance is used and no self-scoped instance is created for that id. One instance per app.</p><p><strong>Use case:</strong> Shared app-wide state (e.g. auth, theme).</p><p><strong>Demo:</strong>  Blocks that use <code>services: [{ id: 'FormState' }]</code> rely on the root FormState service registered in <code>ServiceRegistry</code> and Angular DI.</p>",
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<b>FirstName (root-scoped)</b>: {{FormState.firstName}}',
              },
              services: [{ id: 'GeneralModelService', alias: 'FormState', scope: 'self' as const }],
            },
            {
              component: 'StringInput',
              services: [{ id: 'GeneralModelService', alias: 'FormState', scope: 'self' as const }],
              inputs: {
                label: 'First name',
                value: '[(FormState.firstName)]',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>2.2 Self-scoped services</h4><p><strong>Description:</strong> <code>services: [{ id: 'ServiceId', scope: 'self', alias?: 'Alias' }]</code>. The block loader asks the <strong>ServiceRegistry</strong> for the service type and builds a <strong>child injector</strong> that provides that type. A new instance is then resolved from that child injector (<code>selfInjector.get(..., { self: true })</code>), so you get one instance per block instance. Refs like <code>BlockID:ServiceId.prop</code> target this block's instance only.</p><p><strong>Use case:</strong> Per-page or per-form state (e.g. each page gets its own FormState). It can be referenced as e.g. <code>ExamplePage:FormState.firstName</code>.</p><p><strong>Note:</strong> Self-scoped instances do not automatically override root-scoped services; scope is determined by each block's <code>services</code> configuration.</p>",
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
                html: "<p>This page block has <code>services: [{ id: 'GeneralModelService', alias: 'FormState', scope: 'self' as const }]</code> and the route passes <code>model: { firstName: 'Demo', lastName: 'User', age: 25 }</code>. The block loader attaches the self-scoped FormState instance to the block instance and, when it finds a <code>model</code> signal on the service, wires it to the resolved model signal so reads and writes stay in sync. The read-only and two-way examples above use that same FormState; initial values come from the route model.</p>",
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
                html: "<p><strong>Registering directives:</strong> Register directive types in <strong>DirectiveRegistry</strong> by id. In the block description, set <code>directives: ['DirectiveId']</code>. The loader resolves these ids and passes them as <strong>host directives</strong> when creating the component. The same flat <code>inputs</code> and <code>outputs</code> are applied to the <strong>component and every host directive</strong> that declares that key.</p><p><strong>Validation:</strong> For each key, the loader checks the component and host directives; if <strong>no</strong> target has that input/output name, it logs a warning and skips the key. If a key exists on multiple targets, the resolved value or handler is applied to <strong>every</strong> matching target.</p>",
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
                html: `<pre class="doc-snippet" style="white-space: pre-wrap; word-break: break-all;"><code>{<br/>  component: 'HtmlBlock',<br/>  directives: ['MouseEvents','Block'],<br/>  inputs: {<br/>    html: '&lt;b&gt;&lt;i&gt;Click ME and check the console&lt;/i&gt;&lt;/b&gt;',<br/>    description: {<br/>      component: 'HtmlBlock',<br/>      inputs: {<br/>        html: 'This is nested HTMLBlock as extended input from the Block directive',<br/>      },<br/>    },<br/>  },<br/>  outputs: {<br/>    clicked: {<br/>      ref: 'ExamplePage:FormState.alert',<br/>      params: ['Alert from clicked event'],<br/>    },<br/>  },<br/>}</code></pre>`,
              },
            },
            {
              component: 'HtmlBlock',
              directives: ['MouseEvents', 'Block'],
              inputs: {
                html: '<b>I am an HTML block with a MouseEvents and Blockdirective</b>',
                description: {
                  component: 'HtmlBlock',
                  inputs: {
                    html: 'This is nested HTMLBlock as extended input from the Block directive',
                  },
                },
              },
              outputs: {
                clicked: {
                  ref: 'ExamplePage:FormState.alert',
                  params: [
                    'This a resolved name {{ref("ExamplePage:FormState.firstName") + " " + ref("ExamplePage:FormState.lastName")}} from clicked event',
                  ],
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
                          html: '<p class="doc-surface">This paragraph is rendered from an <strong>inline full block description</strong>: <code>{ component: \'HtmlBlock\', inputs: { html: \'...\' } }</code>. No registry lookup.</p>',
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
          title: '5. Outputs (callable refs)',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>5.1 String or <code>ref</code> object</h4><p>Each <code>outputs</code> entry is a <strong>string</strong> callable ref or an <strong><code>OutputCallObject</code></strong> with at least <code>ref</code>. The <strong>last dot-separated segment</strong> after <code>:</code> (or the last segment for the current block) is the <strong>method name</strong>; the rest is the ref path resolved via the block registry (see <code>splitCallableRef</code> in the library).</p><p><strong>Examples:</strong> <code>\"PersonForm:FormState.age.set\"</code> — call <code>set</code> on the resolved signal (if <code>params</code> is omitted, the emitted event value is passed). <code>{ ref: 'FormState.alert', params: ['Age changed to &#123;&#123;value&#125;&#125;'] }</code> — template strings in <code>params</code> are resolved with the event payload.</p><p><strong>Demo:</strong> Person form <code>NumberInput</code> uses <code>valueChange: { ref: 'FormState.alert', params: ['Age changed to &#123;&#123;value&#125;&#125;'] }</code> and <code>valueChange: 'PersonForm:FormState.age.set'</code>.</p>",
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<h4>5.2 <code>then</code> and <code>onError</code></h4><p>On an <code>OutputCallObject</code>, optional <code>then</code> runs after the main call (and after a returned <strong>Promise</strong> settles). Steps use the same callable <code>ref</code> strings or nested step objects. <code>onError</code> runs when the main promise rejects. There is no separate <code>onSuccess</code> field — use <code>then</code> for post-success chains.</p><h4>5.3 Invalid output value</h4><p>If the value is neither a non-empty callable string nor an object with a <code>ref</code> field, <code>createOutputHandler</code> returns a <strong>no-op</strong>. There is <strong>no</strong> <code>outputHandlers</code> map on <code>BlockDirective</code> or <code>load()</code> options.</p>",
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
          title: 'Example: callable ref on valueChange',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: "<p>Change age; <code>value</code> calls <code>ExamplePage:FormState.alert('Age changed')</code> (see console):</p>",
              },
            },
            {
              component: 'NumberInput',
              inputs: {
                label: 'Age (triggers alert on change)',
                value: '[(ExamplePage:FormState.age)]',
                min: 0,
                max: 120,
              },
              outputs: {
                valueChange: {
                  ref: 'ExamplePage:FormState.alert',
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
                html: '<table class="doc-table"><thead><tr><th>Form</th><th>Meaning</th><th>Example</th></tr></thead><tbody><tr><td><code>serviceOrModel.path</code></td><td>Current block\'s instance and path</td><td><code>FormState.firstName</code>, <code>model.age</code></td></tr><tr><td><code>BlockID:serviceOrModel.path</code></td><td>Named block\'s instance and path (block must have <code>id</code>)</td><td><code>PersonForm:FormState.firstName</code>, <code>LoginPage:AuthState.username</code></td></tr><tr><td><code>ScopeKey/BlockID:...</code></td><td>Block in a scoped registry (<code>BlockRegistryService</code>)</td><td><code>listScope/ItemCard:FormState.title</code> — see Concepts</td></tr></tbody></table><p>Single segment (e.g. <code>FormState</code>) resolves to the instance; with path (e.g. <code>FormState.firstName</code>) the last segment is the property (or signal) on the resolved target.</p>',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>Live:</strong> <code>ExamplePage:FormState.firstName</code> → {{ExamplePage:FormState.firstName}} · <code>ExamplePage:FormState.age</code> → {{ExamplePage:FormState.age}}</p>',
              },
            },
          ],
        },
      },
    ],
  },
];
