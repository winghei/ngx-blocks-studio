# Block loader

The block loader renders Angular components from a **JSON description**. It resolves **instance refs** (e.g. `FormState.firstName` for current block or `PersonForm:FormState.firstName` for a named block), wires **inputs** and **outputs**, and optionally registers block instances by **id** in a **BlockRegistry** so refs can target other blocks in the tree. You can pass a **full description**, or a **block reference** (`id` / `blockId`) to reuse a registered block and optionally **override** only some properties via `blockDefinition` (deep merge).

**Ways to pass a block:**

| Pass | When to use |
|------|------------------|
| Full description `{ component, id?, inputs?, ... }` | Single use, no reuse. |
| Reference `{ blockId: 'X' }` | Reuse block as-is; definition from `blockDefinitions` or global BlockDefinitionsRegistry. |
| Reference + overrides `{ blockId: 'X', blockDefinition: { inputs: { ... } } }` | Same block, override only some input keys (deep merge). Model is passed via `[model]` / `load(..., model, ...)`, not `inputs.model`. |

**Source:** `projects/blocks-studio/src/lib/core/block-loader/`

## Source layout

```
projects/blocks-studio/src/lib/core/block-loader/
├── index.ts                    # Public exports
├── block-description.schema.ts # BlockDescription, BlockReference, safeParse, isBlockReference, resolveBlockReference, deepMergeBlockDefinition
├── block-registry.ts           # BlockRegistry, BlockInstanceHandle, BlockRegistryImpl
├── ref-expressions.ts          # parseRefPath, parseTwoWayRef, classifyTwoWayString
├── ref-resolver.ts             # ResolverContext, getRefValue, setRefValue
├── output-reference.ts         # createOutputHandler (reference vs directive handler)
├── block-loader.service.ts     # BlockLoaderService
└── block.directive.ts          # BlockDirective

projects/blocks-studio/src/lib/core/registry/
└── block-definitions.registry.ts # BlockDefinitionsRegistry (global blockId → definition)
```

## Overview

- **BlockDirective** – Renders one block from a description or block reference; use `[block]` with `[description]="desc"`, and optionally `[model]`, `[blockRegistry]="registry"`, and `[blockDefinitions]="definitions"` so nested blocks share the registry and references resolve.
- **BlockLoaderService** – Validates the description (or resolves a block reference via `blockDefinitions` or global [BlockDefinitionsRegistry](registry.md#block-definitions-registry) and deep-merges `blockDefinition`), resolves the component (via [ComponentRegistry](registry.md)) and optional host directives (via [DirectiveRegistry](registry.md)), builds a child injector for self-scoped services, creates the component with host directives, resolves host directive instances from the injector, builds **instance** (services/state by name), seeds **model** from the directive’s `[model]` input (or the `model` argument when calling `load()`), validates that each input/output key exists on the component or at least one host directive (warns and skips otherwise), then resolves inputs and wires outputs on **all** matching targets (component and directives). Registers/unregisters by **id**.
- **BlockRegistry** – One registry per tree; maps block **id** to a handle with **instance** (and optional **destroy**). Duplicate id in the same tree throws.

## Description shape

You can pass a **full description** (see table below) or a **block reference** to reuse (and optionally override) a definition from `blockDefinitions`:

- **Reference:** `{ blockId: string, id?: string, blockDefinition?: object }`. Lookup uses **blockId** in `blockDefinitions` (if passed to the directive/loader) or in the global **BlockDefinitionsRegistry**; `id` optionally overrides the instance id on the resolved definition.
- **Override:** When `blockDefinition` is provided, it is **deep-merged** onto the base. Only the properties you specify are changed; others (e.g. `inputs.rows`, `component`, `services`) stay from the base. Note: `inputs.model` in the description is not used by the loader; pass the actual model via the directive’s `[model]` or `load(..., model, ...)`.

| Property   | Type     | Required | Description |
|------------|----------|----------|-------------|
| `component` | `string` | Yes (full) | Component key (resolved via [ComponentRegistry](registry.md)). Omit when using a block reference. |
| `id`       | `string` | No  | Unique id for this block; used for registry and cross-block refs. At most one per id per tree. With a block reference, can override the instance id. |
| `services` | `string \| { id, scope?, alias? } \| array` | No | Service ids: **root-scoped** (string or `{ id, alias? }` with no scope) resolved from the host injector when using the directive, or **self-scoped** (`{ id, scope: "self", alias? }`) with a new instance per block. |
| `directives` | `string \| string[]` | No | Directive keys (resolved via [DirectiveRegistry](registry.md)). Applied as host directives on the dynamically created component. Inputs/outputs can target the component and/or these directives; see [Host directives and inputs/outputs](#host-directives-and-inputsoutputs). |
| `inputs`   | `Record<string, unknown>` | No | Inputs for the component and/or host directives. See [Inputs](#inputs) and [Host directives and inputs/outputs](#host-directives-and-inputsoutputs). |
| `outputs`  | `Record<string, unknown>` | No | Output names → handler config for the component and/or host directives. See [Outputs as reference](#outputs-as-reference) and [Host directives and inputs/outputs](#host-directives-and-inputsoutputs). |

---

## Inputs

Input resolution runs in a fixed order. Each input key is handled as follows.

### Literal values

- Numbers, booleans, plain objects, arrays (without refs) are set on the component as-is.
- Plain strings with no `{{ }}` or `[( )]` are set as-is.

### Read-only refs: `{{ refPath }}`

- **Format:** A string that contains at least one `{{ refPath }}` placeholder. Ref path format: `model.info.title` (current block) or `BlockID:model.info.title` (e.g. `"{{FormState.firstName}}"`, `"{{PersonForm:FormState.firstName}}"`). Ref path is trimmed; multiple placeholders are allowed.
- **Behavior:** The loader replaces every `{{ refPath }}` with the current value from that path (signals are read via their getter). It sets the initial interpolated string on the component, then runs an **effect** that re-interpolates when any of the refs change and updates the input.
- **Context:** Current block: `serviceOrModel.path`. Another block: `BlockID:serviceOrModel.path` (e.g. `PersonForm:FormState.firstName`).

### Two-way refs: `[( refPath )]`

- **Format:** The **entire** input value must be exactly a two-way ref string: `"[(refPath)]"` (e.g. `"[(PersonForm:FormState.firstName)]"`). No extra text.
- **No mixing:** Mixing `[( )]` with literals or `{{ }}` in the same string is invalid. The loader throws a clear error if it encounters such a value (e.g. `"prefix [(ref)]"` or `"[(ref)] and {{other}}"`). Use exactly `"[(refPath)]"` for two-way or `"{{ refPath }}"` / templates for read-only.
- **Requirement:** The component must expose that input as a **signal** (or callable that returns the current value). The loader will read it and call `setRefValue` on the ref when it changes.
- **Behavior:**
  1. **Initial:** The ref's current value is resolved and set on the component input.
  2. **Ref → component:** An effect reads the ref; when it changes, the loader calls `setInput` with that value so the component stays in sync (e.g. when another part of the app updates FormState).
  3. **Component → ref:** An effect reads the component's signal; when it changes (e.g. user types), the loader calls `setRefValue` so the ref (e.g. FormState signal) is updated. The ref target must be writable (e.g. Angular `WritableSignal` with `.set()`); the loader never overwrites the signal with a literal.
- **Nested layouts:** When the root block has nested child descriptions (e.g. `inputs.rows` with arrays of `{ component, inputs }`), two-way ref strings inside **child** `inputs` are **not** resolved during that recursion. They are left as `"[(refPath)]"` so that when the child block is loaded later, it still sees the two-way ref and can wire both effects. Only the **current** block's direct two-way ref inputs are resolved and wired.

### Nested structures (e.g. `rows` / `columns`)

- Arrays and objects are recursively resolved. Exception: inside an object that looks like a **block descriptor** (has `component` and `inputs`), the **inputs** subtree is resolved with two-way refs **preserved** (see above).
- So a root block can have `inputs.rows = [ { columns: [ { component: 'StringInput', inputs: { value: '[(PersonForm:FormState.firstName)]' } } ] } ]`. The child's `value` stays as the ref string until the StringInput block is loaded; then that block gets two-way binding for `value`.

### Summary: input resolution order per key

| Input value shape | What happens |
|-------------------|---------------|
| Key is `model` | Ignored: the loader does not read `inputs.model` from the description. Model comes only from directive `[model]` / `load(..., model, ...)` and is passed to every instance service that has a `setModel` method. Not set on component. |
| String with `{{ ... }}` | Interpolate once, set initial; effect re-interpolates and updates. |
| String exactly `[( refPath )]` | Resolve initial from ref; two effects: ref→setInput, component signal→setRefValue. |
| Other string | Left as-is, set on component. |
| Array / object | Recursively resolved; two-way refs preserved inside nested block `inputs`. |

Refs are resolved against the **current block** when no prefix is used (`model.path`). For another block use **BlockID:model.path** (e.g. `PersonForm:FormState.firstName`).

---

## Host directives and inputs/outputs

When a block description includes **`directives`** (an array of directive ids resolved via [DirectiveRegistry](registry.md)), those directives are applied as **host directives** on the dynamically created component. The same flat **`inputs`** and **`outputs`** maps apply to both the component and the host directives.

### Validation first

Before resolving or wiring anything, the loader checks each key in `inputs` and `outputs`:

- **Inputs:** For each key, it checks whether that key exists on the **component** or on **any** host directive instance. If **no** target has the key, the loader logs a warning (e.g. `Block input "foo" is not defined on the component or any host directive; skipping.`) and **skips** that key (no resolution or set).
- **Outputs:** Same for each output key: if neither the component nor any host directive has a subscribable at that key, the loader warns and skips that key.

So resolution and wiring run only for keys that have at least one valid target. Invalid keys are never resolved.

### Name clash: set for all targets

If the **same** key exists on the **component and one or more host directives**, the loader:

- Resolves the value **once** (same rules as [Inputs](#inputs): literals, `{{ }}`, `[( )]`, etc.).
- **Sets** it on **every** target that has that input (component and each directive with that key).
- For **outputs**, builds the handler **once** and **subscribes** on **every** target that has that output.

So there is no “component wins” or “directive wins”: every target that declares the key receives the same value or the same handler.

### How targets are found

- **Input:** A target “has” an input if the component instance or directive instance has that property (e.g. `key in instance`).
- **Output:** A target “has” an output if the instance has a property at that key that has a `.subscribe` method (e.g. an `EventEmitter` or `OutputEmitterRef`).

Host directive instances are obtained from the component’s injector after `createComponent(..., { directives: directiveTypes })`. If a directive type cannot be resolved from the injector, that directive is not considered when computing targets.

---

## Outputs as reference

### How output handling works

1. **Block description `outputs`** – Each output key (e.g. `valueChange`) is either an **output reference** (`type: 'reference'`, `reference`, `method`, optional `params` / `then` / `onSuccess` / `onError`) or a plain value; in the latter case the directive’s **outputHandlers** map is used (key = output name), or a no-op if absent.

2. **Wiring** – The loader’s `wireOutputs` builds a handler per output via `createOutputHandler(outputValue, outputKey, registry, outputHandlers)` and subscribes to the component’s emitter (e.g. `inst['valueChange']`). When the component emits, the handler is called with the event value.

3. **Reference handler** – For an output reference, the handler:
   - Resolves **reference** (e.g. `PersonForm:FormState.age`) through the **BlockRegistry** to the target object (e.g. the `age` signal).
   - Gets the **method** on that target (e.g. `set`).
   - Calls **method** with **params** if provided, otherwise with the emitted value as the first argument (e.g. `age.set(emittedValue)`).
   - If the method returns a Promise, **then** / **onSuccess** / **onError** are invoked by resolving their `reference` + `method` (and optional `params`) the same way and calling them.

**Source:** `output-reference.ts` (`resolveOutputReference`, `createOutputHandler`), `block-loader.service.ts` (`wireOutputs`).

### Output reference shape

When an output value is `{ type: "reference", reference, method, params?, then?, onSuccess?, onError? }`:

- **reference** – Ref path (e.g. `UserForm:FormState` or `UserForm:FormState.age`). For a deep path, the **leaf** is the call target (e.g. the `age` signal).
- **method** – Method name to call on that target (e.g. `setAge` on FormState, or `set` on a signal).
- **params** – Optional array or record; if omitted, the **emitted event value** is passed as the first argument (e.g. `signal.set(emittedValue)`).
- **then** – Optional array of `{ reference, method, params? }` to call after the method resolves (if it returns a Promise).
- **onSuccess** / **onError** – Optional `{ reference, method, params? }` to call on success or error.

**Example: call a signal's `set` with the emitted value**

```json
"outputs": {
  "valueChange": {
    "type": "reference",
    "reference": "PersonForm:FormState.age",
    "method": "set"
  }
}
```

Here the target is the `age` signal; the loader calls `age.set(emittedValue)`. No `params` means the event payload is used.

If the output value is not a reference config, the directive's **outputHandlers** map is used (key = output name).

## Reusing blocks by id (and overriding)

Instead of passing a full description, you can pass a **block reference** so the loader looks up the definition in **blockDefinitions** and optionally **overrides** only some properties.

- **Id-only:** `{ blockId: 'BlockId' }` (optional `id` to override the instance id) → use the registered definition as-is. When `id` is omitted, the base definition’s `id` is kept. Definition is looked up by `blockId` in `blockDefinitions` or the global BlockDefinitionsRegistry.
- **With overrides:** `{ blockId: 'BlockId', blockDefinition: { inputs: { ... } } }` → start from the registered definition and **deep-merge** `blockDefinition` on top. Only the keys you pass are changed (e.g. other `inputs`); `inputs.model` is not used by the loader—pass model via `[model]` or `load(..., model, ...)`. Unrelated properties are never removed.

- **Directive:** set `[blockDefinitions]="definitions"` (e.g. `{ userCard: userCardBlock }`) when you want to supply definitions per tree or route. If a reference’s `blockId` is not in `blockDefinitions`, resolution falls back to the global **BlockDefinitionsRegistry** (see [Registry](registry.md)).
- **Loader:** pass `blockDefinitions` in `BlockLoadOptions` when calling `load()` directly; same fallback to global registry if the key is missing.
- The loader throws only if the block is not found in either `blockDefinitions` or the global registry.

### Example: card template with override

**1. Register a card block (row/column layout):**

```typescript
const userCardBlock = {
  component: 'RowLayout',
  id: 'UserCard',
  inputs: {
    rows: [
      { columns: [{ component: 'HtmlBlock', inputs: { html: '{{UserCard:FormState.name}}' } }] },
      { columns: [{ component: 'StringInput', inputs: { label: 'Name', value: '[(UserCard:FormState.name)]' } }] },
    ],
  },
  services: [{ id: 'FormState', scope: 'self' as const }],
};
```

**2. Reuse it as-is:**

```typescript
data: { block: { blockId: 'UserCard' }, blockDefinitions: { UserCard: userCardBlock } }
```

**3. Reuse with different data (same layout; pass model via `[model]` or route data):**

Pass the model via the directive’s `[model]` input or route data, not via `blockDefinition.inputs.model` (the loader ignores `inputs.model`).

```typescript
data: {
  block: { blockId: 'UserCard' },
  blockDefinitions: { UserCard: userCardBlock },
  model: { name: 'Jane Doe', email: 'jane@example.com' },
}
```

**4. Host template – pass description and definitions:**

```html
<div block [description]="desc" [blockRegistry]="getRegistry()" [blockDefinitions]="blockDefinitions()"></div>
```

**5. Programmatic load with override:**

```typescript
await this.loader.load(
  { blockId: 'UserCard', blockDefinition: { inputs: { model: { name: 'Jane' } } } },
  viewContainerRef,
  { registry, blockDefinitions: { UserCard: userCardBlock } }
);
```

For more examples (full description, route + BlockHost, deep merge behavior), see [Complete examples](#complete-examples) at the end of this doc.

## BlockDirective API

| Input | Type | Description |
|-------|------|-------------|
| `description` | `BlockInput \| BlockReference \| null` | Full block description, or block reference `{ blockId, id?, blockDefinition? }`. When using a reference, definition is resolved from `blockDefinitions` or the global BlockDefinitionsRegistry. |
| `outputHandlers` | `Record<string, (value: unknown) => void>` | Handlers for component outputs; keys match description `outputs`. |
| `blockRegistry` | `BlockRegistry \| null` | Registry for block instances by id; pass from root so nested blocks share it. |
| `blockDefinitions` | `Record<string, unknown> \| null` | Map blockId → full description; used when `description` is a block reference. Missing keys fall back to global BlockDefinitionsRegistry. |
| `model` | `Record<string, unknown> \| string \| undefined` | Optional model for the block (e.g. route data). Passed to the loader; services with `setModel` receive it. Can be a ref path string to bind to another block's model. |

Usage: host element with `[block]` and `[description]="desc"`. Optionally `[model]="model()"`, `[blockRegistry]="registry"`, `[blockDefinitions]="definitions"`, and `[outputHandlers]="handlers"`.

## BlockLoaderService API

| Method | Description |
|--------|-------------|
| `load(description, viewContainerRef, model, options?)` | Load a component from the description. **model** is a `Signal<unknown \| undefined>` (e.g. from the directive's `[model]` input); it seeds `blockInstance['model']` and each service's `setModel`. Builds instance from services, resolves inputs, wires outputs, registers by id. Returns `Promise<BlockLoadResult>`. |

**BlockLoadOptions:** `outputHandlers?`, `registry?`, `blockDefinitions?` (blockId → full description; used when description is a block reference; missing keys use global BlockDefinitionsRegistry).

**BlockLoadResult:** `componentRef`, `destroy()` (unregister, unsubscribe outputs, remove view, destroy component), `updateInputs(description)` (re-parse and re-apply model, inputs, and effects from a new description).

## Block registry

- **One registry per tree** – Create a `BlockRegistryImpl` (or implement `BlockRegistry`) at the root and pass it to the root `[block]` via `[blockRegistry]`.
- **Id uniqueness** – Each **id** may occur at most once in the same registry.
- **Handle** – `BlockInstanceHandle` has `instance: Record<string, unknown>` (services/state by name) and optional `destroy()`.

## Layout (rows / columns)

Layout components can receive `inputs.rows` (and each row `inputs.columns`) as arrays of **child descriptions**. Each child is rendered with the same directive and registry, e.g.:

```html
<ng-container *ngFor="let row of rows()">
  <ng-container *ngFor="let col of row.columns" [block] [description]="col" [blockRegistry]="registry()"></ng-container>
</ng-container>
```

Child descriptions have the same shape: `component`, `id?`, `services?`, `inputs?`, `outputs?`.

---

## Complete examples

### Example 1: Full description (inline)

Use when the block is defined once and not reused elsewhere.

```typescript
const block = {
  component: 'RowLayout',
  id: 'MyForm',
  services: [{ id: 'FormState', scope: 'self' as const }],
  inputs: {
    model: { firstName: 'Jane', lastName: 'Doe' },
    rows: [
      {
        columns: [
          {
            component: 'StringInput',
            inputs: { label: 'First name', value: '[(MyForm:FormState.firstName)]' },
          },
        ],
      },
    ],
  },
};

// In template (e.g. BlockHost):
// <div block [description]="block" [blockRegistry]="getRegistry()"></div>
```

### Example 2: Reuse by blockId (no overrides)

Register the block in `blockDefinitions` (or the global BlockDefinitionsRegistry) and reference it by `blockId`. Same block, same data every time.

```typescript
// Define once, export for registration
const personFormBlock = {
  component: 'RowLayout',
  id: 'PersonForm',
  services: [{ id: 'FormState', scope: 'self' as const }],
  inputs: {
    rows: [/* ... */],
  },
};

// Route: reuse by blockId
const route = {
  path: 'person',
  component: 'BlockHost',
  data: {
    block: { blockId: 'PersonForm' },
    blockDefinitions: { PersonForm: personFormBlock },
    model: { firstName: 'Jane', lastName: 'Doe', age: 28 },
  },
};

// Host template must pass description, blockDefinitions, and optionally model
// [description]="blockDescription()" [blockDefinitions]="blockDefinitions()" [model]="model()"
```

### Example 3: Reuse with overrides (deep merge)

Use the same layout/structure but pass different data via the directive’s `[model]` (or override other `inputs` in `blockDefinition`). The loader does not use `inputs.model` from the description.

```typescript
// Base card: row/column layout + FormState
const userCardBlock = {
  component: 'RowLayout',
  id: 'UserCard',
  services: [{ id: 'FormState', scope: 'self' as const }],
  inputs: {
    model: { name: '', email: '' },
    rows: [
      {
        columns: [
          { component: 'HtmlBlock', inputs: { html: '{{UserCard:FormState.name}}' } },
        ],
      },
      {
        columns: [
          { component: 'StringInput', inputs: { label: 'Name', value: '[(UserCard:FormState.name)]' } },
          { component: 'StringInput', inputs: { label: 'Email', value: '[(UserCard:FormState.email)]' } },
        ],
      },
    ],
  },
};

// Usage A: same card, different initial model (pass via [model], not inputs.model)
const blockWithOverride = { blockId: 'UserCard' };
// In host: [model]="modelSignal" with modelSignal = signal({ name: 'Jane Doe', email: 'jane@example.com' })

// Usage B: override instance id; pass model via [model]
const blockWithIdAndModel = {
  blockId: 'UserCard',
  blockDefinition: { id: 'UserCardInstance1' },
};
// Host: [model]="signal({ name: 'John', email: 'john@example.com' })"

// Register and pass to directive (include [model] for initial data)
const blockDefinitions = { UserCard: userCardBlock };
// <div block [description]="blockWithOverride" [model]="modelSignal" [blockDefinitions]="blockDefinitions" [blockRegistry]="registry()"></div>
```

### Example 4: Route + BlockHost (end-to-end)

Typical setup: route data carries the block (full or reference) and optional `blockDefinitions`; BlockHost reads route data and passes everything to the directive.

**Route config (e.g. `route-data/person-form.block.ts`):**

```typescript
const personFormBlock = { component: 'RowLayout', id: 'PersonForm', /* ... */ };

export const routes = [
  {
    path: '',
    component: 'BlockHost',
    title: 'Person info',
    data: {
      block: { blockId: 'PersonForm', id: 'PersonForm' },
      blockDefinitions: { PersonForm: personFormBlock },
      model: { firstName: 'Jane', lastName: 'Doe', age: 28 },
    },
  },
];
```

**BlockHost component:**

```typescript
export class BlockHostComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly blockRegistry = inject(BlockRegistryService);
  private readonly routeData = toSignal(this.route.data, { initialValue: {} as Record<string, unknown> });

  readonly blockDescription = computed(() => this.routeData()['block'] ?? null);
  readonly blockDefinitions = computed(
    () => (this.routeData()['blockDefinitions'] as Record<string, unknown> | undefined) ?? null
  );
  readonly model = computed(() => this.routeData()['model'] ?? undefined);

  getRegistry(): BlockRegistry {
    return this.blockRegistry.registry;
  }
}
```

**BlockHost template:**

```html
@if (blockDescription(); as desc) {
  <div
    block
    [description]="desc"
    [model]="model()"
    [blockRegistry]="getRegistry()"
    [blockDefinitions]="blockDefinitions()">
  </div>
} @else {
  <p>No block in route data.</p>
}
```

### Example 5: Programmatic load (BlockLoaderService)

When loading blocks from code (e.g. dynamic slot or modal), pass a **model** signal as the third argument (e.g. `signal(undefined)` or a signal of your initial data):

```typescript
// By blockId (definition from options or global registry)
await this.loader.load(
  { blockId: 'PersonForm' },
  viewContainerRef,
  this.modelSignal, // Signal<unknown | undefined>
  { registry: this.registry, blockDefinitions: { PersonForm: personFormBlock } }
);

// With overrides
await this.loader.load(
  { blockId: 'UserCard' },
  viewContainerRef,
  signal({ name: 'Jane', email: 'jane@example.com' }),  // model via 3rd arg, not blockDefinition.inputs.model
  { registry: this.registry, blockDefinitions: { UserCard: userCardBlock } }
);
```

### Deep merge behavior (blockDefinition)

- **Objects** are merged by key. Only keys present in `blockDefinition` override the base; others are unchanged. Example: `blockDefinition: { inputs: { someKey: {...} } }` replaces only that input and keeps `inputs.rows`, etc. (Note: `inputs.model` is not read by the loader.)
- **Arrays** in `blockDefinition` replace the base array entirely (no element-wise merge).
- **Primitives** in `blockDefinition` replace the base value.
