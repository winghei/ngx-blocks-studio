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
├── output-reference.ts         # createOutputHandler (callable ref strings + OutputCallObject)
├── block-loader.service.ts     # BlockLoaderService
└── block.directive.ts          # BlockDirective

projects/blocks-studio/src/lib/core/registry/
└── block-definitions.registry.ts # BlockDefinitionsRegistry (global blockId → definition)
```

## Overview

- **BlockDirective** – Renders one block from a description or block reference; use `[block]` with `[description]="desc"`, and optionally `[model]`, `[blockRegistry]="registry"`, and `[blockDefinitions]="definitions"` so nested blocks share the registry and references resolve.
- **BlockLoaderService** – Validates the description (or resolves a block reference via `blockDefinitions` or global [BlockDefinitionsRegistry](registry.md#block-definitions-registry) and deep-merges `blockDefinition`), resolves the component (via [ComponentRegistry](registry.md)) and optional host directive **types** (via [DirectiveRegistry](registry.md)), builds a child injector for self-scoped services, creates the component with **`createComponent`** and **Angular `inputBinding` / `twoWayBinding` / `outputBinding`** so inputs, two-way refs, and outputs stay reactive, builds **instance** (services/state by name), seeds **`blockInstance.model`** from the directive’s `[model]` input (or the `model` signal passed to `load()`), validates that each input/output key exists on the component or at least one host directive (warns and skips otherwise), then applies the same resolved bindings to **all** matching targets (component and host directives). Registers the block by **id** when present.
- **BlockRegistry** – One registry per tree; maps block **id** to a **`BlockInstanceHandle`** with **`instance`** (`CurrentInstance`: `model` signal + `services` map) and optional **`destroy`**. Duplicate id in the same tree throws.

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
- **Behavior:** The loader builds a **computed** (via `resolveTemplateString`) so the input stays reactive: when any referenced signal or nested ref changes, the bound input updates.
- **Context:** Current block: `serviceOrModel.path`. Another block: `BlockID:serviceOrModel.path` (e.g. `PersonForm:FormState.firstName`).

### Two-way refs: `[( refPath )]`

- **Format:** The **entire** input value must be exactly a two-way ref string: `"[(refPath)]"` (e.g. `"[(PersonForm:FormState.firstName)]"`). No extra text.
- **No mixing:** Mixing `[( )]` with literals or `{{ }}` in the same string is invalid. The loader throws a clear error if it encounters such a value (e.g. `"prefix [(ref)]"` or `"[(ref)] and {{other}}"`). Use exactly `"[(refPath)]"` for two-way or `"{{ refPath }}"` / templates for read-only.
- **Requirement:** The resolved ref for a two-way input should be a **`WritableSignal`** when that input participates in two-way binding (`twoWayBinding`); otherwise the loader may fall back to a read-only linked signal and warn.
- **Behavior:** The loader uses Angular **`twoWayBinding`**: the ref side is wired as a `WritableSignal` where possible; ref and component stay in sync through the binding API (not manual `setRefValue` loops in application code).
- **Nested layouts:** When the root block has nested child descriptions (e.g. `inputs.rows` with arrays of `{ component, inputs }`), two-way ref strings inside **child** `inputs` are **not** resolved during parent load. They remain `"[(refPath)]"` until **that** child block is loaded, which then applies two-way bindings for its own inputs.

### Nested structures (e.g. `rows` / `columns`)

- Arrays and objects are recursively resolved. Exception: inside an object that looks like a **block descriptor** (has `component` and `inputs`), the **inputs** subtree is resolved with two-way refs **preserved** (see above).
- So a root block can have `inputs.rows = [ { columns: [ { component: 'StringInput', inputs: { value: '[(PersonForm:FormState.firstName)]' } } ] } ]`. The child's `value` stays as the ref string until the StringInput block is loaded; then that block gets two-way binding for `value`.

### Summary: input resolution order per key

| Input value shape | What happens |
|-------------------|---------------|
| Key is `model` | **Two channels:** **`blockInstance.model`** (refs like `model.*`, template context) is set **only** from **`[model]`** on **`BlockDirective`** / the **`model`** signal passed to **`load()`**—not from `description.inputs`. **Separately**, if the dynamic component or a **host directive** declares a **`model` `@Input`**, then **`inputs.model`** in the description **does** bind that input using the same rules as any other key (literals, `{{ }}`, `[( )]`). That component/host binding does **not** replace or set **`blockInstance.model`**; see [Services and model](#services-and-model). |
| String with `{{ ... }}` | Built as a reactive **computed** over `resolveTemplateString` (updates when refs change). |
| String exactly `[( refPath )]` | **Two-way binding** via `twoWayBinding` to the resolved writable ref when possible. |
| Other string | Left as-is, set on component. |
| Array / object | Recursively resolved; two-way refs preserved inside nested block `inputs`. |

Refs are resolved against the **current block** when no prefix is used (`model.path`). For another block use **BlockID:model.path** (e.g. `PersonForm:FormState.firstName`).

### Services and model {#services-and-model}

- **`blockInstance.model`** is set from the **`model`** signal passed to **`load()`** (or the **`BlockDirective`** `[model]` input, which is a signal).
- **Root-scoped** services: the loader resolves the **class** via **`ServiceRegistry.getType`**, then obtains an instance from the **view container’s injector** (`injector.get(token, null)`). If Angular provides the service, it is stored on **`blockInstance.services`** under the alias. **No automatic `setModel` call** is made for root services.
- **Self-scoped** services: the loader creates a **child injector** with `useClass` providers for each self-scoped type, then gets instances with `{ self: true }`. If the service has a **`model` writable signal** and a model value is present, the loader sets that signal and may call **`setModel()`** on the service.

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
- For **outputs**, builds the handler **once** and applies **`outputBinding`** on **every** target that has that output name.

So there is no “component wins” or “directive wins”: every target that declares the key receives the same value or the same handler.

### How targets are found

- **Input:** A target “has” an input if the component instance or directive instance has that property (e.g. `key in instance`).
- **Output:** A target “has” an output if component/directive metadata lists that **public output name** (see `getBlockInputsAndOutputs` / `ɵcmp` / `ɵdir` metadata).

Host directive instances are obtained from the component’s injector after `createComponent(..., { directives: directiveTypes })`. If a directive type cannot be resolved from the injector, that directive is not considered when computing targets.

---

## Outputs (callable refs) {#outputs-callable-refs}

Validated by **`BlockDescriptionSchema`**: each output value is either a **string** or an **`OutputCallObject`**. There is **no** separate `outputHandlers` map on **`BlockDirective`** or **`BlockLoadOptions`**—if the value is neither a valid callable string nor an object with a **`ref`** field, **`createOutputHandler`** returns a **no-op**.

**Source:** `block-bindings.ts` (`resolveBlockInputsAndOutputs` → `createOutputHandler`), `output-reference.ts`, `block-loader.service.ts` (bindings include **`outputBinding`** per output key).

### How output handling works

1. For each key in **`outputs`**, the loader builds a handler with **`createOutputHandler(value, key, ctx)`**.
2. **String** values are treated as a **callable ref template** (after template interpolation): the **last dot-separated segment** after `:` (or the last segment for current-block refs) is the **method name**; the part before that is the **ref path** resolved via **`BlockRegistry`** / **`resolveRefPath`** (see **`splitCallableRef`** in `output-reference.ts`).
3. **Object** values must match **`OutputCallObject`**: at minimum **`ref: string`** (same callable format), plus optional **`when`**, **`params`**, **`then`**, **`onError`**. Async **`then`** steps use the same callable ref shape (`ref` + method as last segment).

### Callable ref examples

Call **`set`** on the **`age`** signal registered as `PersonForm:FormState.age`:

```json
"outputs": {
  "valueChange": "PersonForm:FormState.age.set"
}
```

Or with an object (params, chaining):

```json
"outputs": {
  "valueChange": {
    "ref": "PersonForm:FormState.age.set",
    "params": []
  }
}
```

If **`params`** is omitted, the **emitted event value** is passed as the only argument (e.g. `signal.set(emittedValue)`).

### `then` and `onError`

- **`then`**: array of steps (string callable refs or `{ ref, when?, params?, then? }`) run after the main handler succeeds; if the main call returns a **Promise**, steps run after it settles.
- **`onError`**: `{ ref, when?, params }` — invoked when the main promise rejects; **`ref`** is a callable path resolved the same way.

There is **no** separate **`onSuccess`** field in the schema; use **`then`** for post-success chains.

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
import { signal } from '@angular/core';

const model = signal<unknown | undefined>(undefined);

await this.loader.load(
  { blockId: 'UserCard', blockDefinition: { inputs: { /* … */ } } },
  viewContainerRef,
  model,
  { registry, blockDefinitions: { UserCard: userCardBlock } },
);
```

For more examples (full description, route + BlockHost, deep merge behavior), see [Complete examples](#complete-examples) at the end of this doc.

## BlockDirective API

| Input | Type | Description |
|-------|------|-------------|
| `description` | `BlockInput \| BlockReference \| null` | Full block description, or block reference `{ blockId, id?, blockDefinition? }`. When using a reference, definition is resolved from `blockDefinitions` or the global BlockDefinitionsRegistry. |
| `blockRegistry` | `BlockRegistry \| null` | Registry for block instances by id; pass from root so nested blocks share it. |
| `blockDefinitions` | `Record<string, BlockDefinitionOrLoader> \| null` | Map blockId → full description or lazy loader; used when `description` is a block reference. Missing keys fall back to global BlockDefinitionsRegistry. |
| `model` | `Record<string, unknown> \| string \| undefined` | Optional model for the block (e.g. route data). Passed to the loader as a signal; see [Services and model](#services-and-model). Can be a ref path string or contain `{{ }}` templates for nested model interpolation. |
| `reloadKey` | `unknown` | When this value changes, the directive forces a reload even if the component and services are unchanged (e.g. tabs). |

Usage: host element with `[block]` and `[description]="desc"`. Optionally `[model]`, `[blockRegistry]`, `[blockDefinitions]`, and `[reloadKey]`.

## BlockLoaderService API

| Method | Description |
|--------|-------------|
| `load(description, viewContainerRef, model, options?)` | Load a component from the description. **model** is a `Signal<unknown \| undefined>` (e.g. the **`BlockDirective`** `[model]` input signal). Resolves services, builds **`inputBinding` / `twoWayBinding` / `outputBinding`**, registers by **id** when present. Returns **`Promise<ComponentRef<unknown>>`**. |

**BlockLoadOptions:** `registry?`, `blockDefinitions?` (blockId → full description or loader; used when description is a block reference; missing keys use global BlockDefinitionsRegistry).

**Note:** Unregistering and destroying the view is the responsibility of the caller (e.g. **`BlockDirective`** clears the view container and unregisters the block id on destroy). There is no **`BlockLoadResult`** wrapper in the current API.

## Block registry

- **One registry per tree** – Create a `BlockRegistryImpl` (or implement `BlockRegistry`) at the root and pass it to the root `[block]` via `[blockRegistry]`.
- **Id uniqueness** – Each **id** may occur at most once in the same registry.
- **Handle** – `BlockInstanceHandle` has **`instance: CurrentInstance`** (`model` signal + **`services`** map) and optional **`destroy()`**.

## Layout (rows / columns)

Layout components can receive `inputs.rows` (and each row `inputs.columns`) as arrays of **child descriptions**. Each child is rendered with the same directive and registry, e.g.:

```html
@for (row of rows(); track row) {
  @for (col of row.columns; track col) {
    <ng-container [block] [description]="col" [blockRegistry]="registry()"></ng-container>
  }
}
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
