/**
 * Block loader doc content as block rows.
 * Source: docs/core/block-loader.md
 */

export const blockLoaderRows = [
  {
    columns: [
      {
        component: 'Section',
        inputs: {
          title: 'Block loader',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Renders Angular components from a <strong>JSON description</strong>. Resolves <strong>instance refs</strong> (e.g. <code>FormState.firstName</code> or <code>PersonForm:FormState.firstName</code>), wires <strong>inputs</strong> and <strong>outputs</strong>, and optionally registers block instances by <strong>id</strong> in a <strong>BlockRegistry</strong> so refs can target other blocks.</p><p><strong>Ways to pass a block:</strong></p><ul><li><strong>Full description</strong> <code>{ component, id?, inputs?, ... }</code> – single use, no reuse.</li><li><strong>Reference</strong> <code>{ blockId: \'X\' }</code> – reuse block as-is from BlockDefinitionsRegistry.</li><li><strong>Reference + overrides</strong> <code>{ blockId: \'X\', blockDefinition: { inputs: { ... } } }</code> – deep-merge overrides. Model is passed via <code>[model]</code> / <code>load(..., model, ...)</code>, not <code>inputs.model</code>.</li></ul><p><strong>Source:</strong> <code>projects/blocks-studio/src/lib/core/block-loader/</code></p>',
              },
            },
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>Example: full description (left)</strong> vs <strong>blockId reference (right)</strong>. Both are loaded by the same BlockDirective; the right column reuses the registered <code>AppNav</code> block.</p>',
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
                          html: '<p class="doc-surface">Full description: <code>{ component: \'HtmlBlock\', inputs: { html: \'...\' } }</code>. No registry lookup.</p>',
                        },
                      },
                      {
                        component: 'Section',
                        inputs: {
                          title: 'blockId: \'AppNav\'',
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
          title: 'Description shape',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>Property</strong> · <strong>Type</strong> · <strong>Description</strong></p><ul><li><code>component</code> (string, required for full desc) – Component key resolved via ComponentRegistry.</li><li><code>id</code> (string, optional) – Unique id for this block; used for registry and cross-block refs.</li><li><code>services</code> – Root-scoped (string or <code>{ id, alias? }</code>) or self-scoped <code>{ id, scope: \'self\', alias? }</code>.</li><li><code>directives</code> – Directive keys (DirectiveRegistry); applied as host directives.</li><li><code>inputs</code> – Record of inputs for component and/or host directives.</li><li><code>outputs</code> – Output names → callable ref <strong>string</strong> or <code>OutputCallObject</code> (<code>ref</code> plus optional <code>when</code>, <code>params</code>, <code>then</code>, <code>onError</code>).</li></ul>',
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
          title: 'Inputs',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>Literal values:</strong> Numbers, booleans, objects, arrays, plain strings (no <code>&#123;&#123; &#125;&#125;</code> or <code>&#91;&#40; &#41;&#93;</code>) are set as-is.</p><p><strong>Read-only refs <code>&#123;&#123; refPath &#125;&#125;</code>:</strong> String with placeholders; loader replaces each <code>&#123;&#123; refPath &#125;&#125;</code> with the current value, sets initial interpolated string, then runs an <strong>effect</strong> that re-interpolates when refs change.</p><p><strong>Two-way refs <code>&#91;&#40; refPath &#41;&#93;</code>:</strong> The <strong>entire</strong> input value must be exactly <code>"&#91;&#40;refPath&#41;&#93;"</code>. No mixing with literals or <code>&#123;&#123; &#125;&#125;</code>. (1) Initial value from ref set on component. (2) Effect: ref → setInput. (3) Effect: component signal → setRefValue. The ref target must be writable (e.g. WritableSignal with <code>.set()</code>).</p><p><strong>Nested structures:</strong> Arrays/objects are recursively resolved. Inside a block descriptor (has <code>component</code> and <code>inputs</code>), two-way ref strings in <strong>child</strong> inputs are preserved until that child block is loaded, then wired.</p>',
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
          title: 'Host directives and inputs/outputs',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>When a block has <code>directives</code>, those directives are applied as <strong>host directives</strong>. The same flat <code>inputs</code> and <code>outputs</code> apply to the component and every host directive.</p><p><strong>Validation:</strong> For each input/output key, the loader checks whether that key exists on the component or any host directive. If <strong>no</strong> target has the key, it logs a warning and skips that key.</p><p><strong>Name clash:</strong> If the same key exists on the component and one or more host directives, the loader resolves the value once and <strong>sets</strong> it on <strong>every</strong> target that has that input (or subscribes the same handler on every target that has that output).</p>',
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
          title: 'Outputs (callable refs)',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p>Each output value is a <strong>string</strong> callable ref (e.g. <code>PersonForm:FormState.age.set</code>) or an <code>OutputCallObject</code> with <code>ref</code> and optional <code>when</code>, <code>params</code>, <code>then</code>, <code>onError</code>. The last path segment is the method name; the loader resolves the target and invokes it (if <code>params</code> is omitted, the emitted value is passed). If the call returns a Promise, <code>then</code> / <code>onError</code> run after settle.</p><p>Invalid or missing shapes get a <strong>no-op</strong> handler. There is no <code>outputHandlers</code> map on <code>BlockDirective</code> or <code>load()</code>.</p>',
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
          title: 'Reusing blocks by id',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>Id-only:</strong> <code>{ blockId: \'BlockId\' }</code> (optional <code>id</code> to override instance id) → use the registered definition as-is. Lookup by <code>blockId</code> in <code>blockDefinitions</code> or global BlockDefinitionsRegistry.</p><p><strong>With overrides:</strong> <code>{ blockId: \'BlockId\', blockDefinition: { inputs: { ... } } }</code> → deep-merge <code>blockDefinition</code> on top. <code>inputs.model</code> is not used by the loader—pass model via <code>[model]</code> or <code>load(..., model, ...)</code>.</p><p>Set <code>[blockDefinitions]="definitions"</code> on the directive when supplying definitions per tree or route. If a reference\'s <code>blockId</code> is not in <code>blockDefinitions</code>, resolution falls back to the global BlockDefinitionsRegistry.</p>',
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
          title: 'BlockDirective and BlockLoaderService',
          children: [
            {
              component: 'HtmlBlock',
              inputs: {
                html: '<p><strong>BlockDirective</strong> inputs: <code>description</code> (full or block reference) · <code>outputHandlers</code> · <code>blockRegistry</code> · <code>blockDefinitions</code> · <code>model</code>. Usage: host element with <code>[block]</code> and <code>[description]="desc"</code>.</p><p><strong>BlockLoaderService</strong>: <code>load(description, viewContainerRef, model, options?)</code> – model is a <code>Signal&lt;unknown | undefined&gt;</code>; options: <code>outputHandlers?</code>, <code>registry?</code>, <code>blockDefinitions?</code>. Returns <code>Promise&lt;BlockLoadResult&gt;</code> with <code>componentRef</code>, <code>destroy()</code>, <code>updateInputs(description)</code>.</p><p><strong>BlockRegistry:</strong> One registry per tree; pass via <code>[blockRegistry]</code>. Each <code>id</code> may occur at most once. Handle has <code>instance</code> and optional <code>destroy()</code>.</p>',
              },
            },
          ],
        },
      },
    ],
  },
];
