# Block loader

The block loader renders Angular components from a **JSON description**. It resolves **instance refs** (e.g. `instance.FormState.firstName` or `UserForm.instance.FormState.firstName`), wires **inputs** and **outputs**, and optionally registers block instances by **id** in a **BlockRegistry** so refs can target other blocks in the tree. You can pass a **full description**, or a **block reference** (`id` / `blockId`) to reuse a registered block and optionally **override** only some properties via `blockDefinition` (deep merge).

**Ways to pass a block:**

| Pass | When to use |
|------|------------------|
| Full description `{ component, id?, inputs?, ... }` | Single use, no reuse. |
| Reference `{ id: 'X' }` or `{ blockId: 'X' }` | Reuse registered block as-is; need `blockDefinitions`. |
| Reference + overrides `{ blockId: 'X', blockDefinition: { inputs: { model: {...} } } }` | Same block, override only some keys (deep merge). |

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
```

## Overview

- **BlockDirective** – Renders one block from a description or block reference; use `[block]` with `[description]="desc"`, and optionally `[blockRegistry]="registry"` and `[blockDefinitions]="definitions"` so nested blocks share the registry and references resolve.
- **BlockLoaderService** – Validates the description (or resolves a block reference and deep-merges `blockDefinition`), resolves the component (via [ComponentRegistry](registry.md)), builds a child injector for self-scoped services, creates the component, builds **instance** (services/state by name), seeds **model** from `inputs.model` if present, resolves inputs (refs or literals), wires outputs (reference-based or directive-provided), and registers/unregisters by **id**.
- **BlockRegistry** – One registry per tree; maps block **id** to a handle with **instance** (and optional **destroy**). Duplicate id in the same tree throws.

## Description shape

You can pass a **full description** (see table below) or a **block reference** to reuse (and optionally override) a definition from `blockDefinitions`:

- **Reference:** `{ id: string }` or `{ blockId: string, blockDefinition?: object }`. Lookup key is `id` or `blockId`.
- **Override:** When `blockDefinition` is provided, it is **deep-merged** onto the registered definition. Only the properties you specify are changed; others (e.g. `inputs.rows`, `component`, `services`) stay from the base. Example: `{ blockId: 'userCard', blockDefinition: { inputs: { model: { name: 'Jane' } } } }` keeps the card layout and only overrides `inputs.model`.

| Property   | Type     | Required | Description |
|------------|----------|----------|-------------|
| `component` | `string` | Yes (full) | Component key (resolved via [ComponentRegistry](registry.md)). Omit when using id-only. |
| `id`       | `string` | No  | Unique id for this block; used for registry and cross-block refs. At most one per id per tree. For id-only, this is the key to look up in `blockDefinitions`. |
| `services` | `string \| { id, scope: "self" } \| array` | No | Root-scoped (string) or self-scoped (`{ id, scope: "self" }`) service ids. |
| `inputs`   | `Record<string, unknown>` | No | Component inputs. See [Inputs](#inputs) for value types and special cases. |
| `outputs`  | `Record<string, unknown>` | No | Output names → handler config. See [Outputs as reference](#outputs-as-reference). |

---

## Inputs

Input resolution runs in a fixed order. Each input key (except `model`) is handled as follows.

### Reserved: `model`

- **Not** set on the component.
- After building the block instance (self-scoped services by name), the loader checks each instance service for a `setModel` method. For every service that has one, it calls `setModel(desc.inputs.model)`. Use this to seed initial state for any service that supports it as part of its lifecycle (e.g. `inputs: { model: { firstName: 'Jane', age: 28 } }`).

### Literal values

- Numbers, booleans, plain objects, arrays (without refs) are set on the component as-is.
- Plain strings with no `{{ }}` or `[( )]` are set as-is.

### Read-only refs: `{{ refPath }}`

- **Format:** A string that contains at least one `{{ refPath }}` placeholder (e.g. `"Hello {{PersonForm.instance.FormState.firstName}}"` or `"{{instance.FormState.firstName}}"`). Ref path is trimmed; multiple placeholders are allowed.
- **Behavior:** The loader replaces every `{{ refPath }}` with the current value from that path (signals are read via their getter). It sets the initial interpolated string on the component, then runs an **effect** that re-interpolates when any of the refs change and updates the input.
- **Context:** Refs without a block id use the current block's instance; for cross-block use `BlockId.instance.path` (e.g. `PersonForm.instance.FormState.firstName`).

### Two-way refs: `[( refPath )]`

- **Format:** The **entire** input value must be exactly a two-way ref string: `"[(refPath)]"` (e.g. `"[(PersonForm.instance.FormState.firstName)]"`). No extra text.
- **No mixing:** Mixing `[( )]` with literals or `{{ }}` in the same string is invalid. The loader throws a clear error if it encounters such a value (e.g. `"prefix [(ref)]"` or `"[(ref)] and {{other}}"`). Use exactly `"[(refPath)]"` for two-way or `"{{ refPath }}"` / templates for read-only.
- **Requirement:** The component must expose that input as a **signal** (or callable that returns the current value). The loader will read it and call `setRefValue` on the ref when it changes.
- **Behavior:**
  1. **Initial:** The ref's current value is resolved and set on the component input.
  2. **Ref → component:** An effect reads the ref; when it changes, the loader calls `setInput` with that value so the component stays in sync (e.g. when another part of the app updates FormState).
  3. **Component → ref:** An effect reads the component's signal; when it changes (e.g. user types), the loader calls `setRefValue` so the ref (e.g. FormState signal) is updated. The ref target must be writable (e.g. Angular `WritableSignal` with `.set()`); the loader never overwrites the signal with a literal.
- **Nested layouts:** When the root block has nested child descriptions (e.g. `inputs.rows` with arrays of `{ component, inputs }`), two-way ref strings inside **child** `inputs` are **not** resolved during that recursion. They are left as `"[(refPath)]"` so that when the child block is loaded later, it still sees the two-way ref and can wire both effects. Only the **current** block's direct two-way ref inputs are resolved and wired.

### Nested structures (e.g. `rows` / `columns`)

- Arrays and objects are recursively resolved. Exception: inside an object that looks like a **block descriptor** (has `component` and `inputs`), the **inputs** subtree is resolved with two-way refs **preserved** (see above).
- So a root block can have `inputs.rows = [ { columns: [ { component: 'StringInput', inputs: { value: '[(PersonForm.instance.FormState.firstName)]' } } ] } ]`. The child's `value` stays as the ref string until the StringInput block is loaded; then that block gets two-way binding for `value`.

### Summary: input resolution order per key

| Input value shape | What happens |
|-------------------|---------------|
| Key is `model` | Skipped for component; passed to every instance service that has a `setModel` method. |
| String with `{{ ... }}` | Interpolate once, set initial; effect re-interpolates and updates. |
| String exactly `[( refPath )]` | Resolve initial from ref; two effects: ref→setInput, component signal→setRefValue. |
| Other string | Left as-is, set on component. |
| Array / object | Recursively resolved; two-way refs preserved inside nested block `inputs`. |

Refs are resolved against the **nearest block with an id** (context). For cross-block refs use **BlockId.instance.path** (e.g. `PersonForm.instance.FormState.firstName`).

---

## Outputs as reference

When an output value is `{ type: "reference", reference, method, params?, then?, onSuccess?, onError? }`:

- **reference** – Ref path to the target. Can be the **instance** (e.g. `UserForm.instance.FormState`) or a **deep path** to a property (e.g. `UserForm.instance.FormState.age`). For a deep path, the **leaf** is the call target (e.g. the `age` signal).
- **method** – Method name to call on that target (e.g. `setAge` on FormState, or `set` on a signal).
- **params** – Optional array or record; if omitted, the **emitted event value** is passed as the first argument (e.g. `signal.set(emittedValue)`).
- **then** – Optional array of `{ reference, method, params? }` to call after the method resolves (if it returns a Promise).
- **onSuccess** / **onError** – Optional `{ reference, method, params? }` to call on success or error.

**Example: call a signal's `set` with the emitted value**

```json
"outputs": {
  "valueChange": {
    "type": "reference",
    "reference": "PersonForm.instance.FormState.age",
    "method": "set"
  }
}
```

Here the target is the `age` signal; the loader calls `age.set(emittedValue)`. No `params` means the event payload is used.

If the output value is not a reference config, the directive's **outputHandlers** map is used (key = output name).

## Reusing blocks by id (and overriding)

Instead of passing a full description, you can pass a **block reference** so the loader looks up the definition in **blockDefinitions** and optionally **overrides** only some properties.

- **Id-only:** `{ id: 'BlockId' }` or `{ blockId: 'BlockId' }` → use the registered definition as-is.
- **With overrides:** `{ blockId: 'BlockId', blockDefinition: { inputs: { model: {...} } } }` → start from the registered definition and **deep-merge** `blockDefinition` on top. Only the keys you pass are changed; e.g. `inputs.model` is overridden but `inputs.rows` and everything else stay from the base. Unrelated properties are never removed.

- **Directive:** set `[blockDefinitions]="definitions"` (e.g. `{ userCard: userCardBlock }`).
- **Loader:** pass `blockDefinitions` in `BlockLoadOptions` when calling `load()` directly.
- If the reference has no matching key in `blockDefinitions`, the loader throws.

### Example: card template with override

**1. Register a card block (row/column layout):**

```typescript
const userCardBlock = {
  component: 'RowLayout',
  id: 'UserCard',
  inputs: {
    rows: [
      { columns: [{ component: 'HtmlBlock', inputs: { html: '{{UserCard.instance.FormState.name}}' } }] },
      { columns: [{ component: 'StringInput', inputs: { label: 'Name', value: '[(UserCard.instance.FormState.name)]' } }] },
    ],
  },
  services: [{ id: 'FormState', scope: 'self' as const }],
};
```

**2. Reuse it as-is:**

```typescript
data: { block: { blockId: 'UserCard' }, blockDefinitions: { UserCard: userCardBlock } }
```

**3. Reuse and override only `inputs.model` (same layout, different data):**

```typescript
data: {
  block: {
    blockId: 'UserCard',
    blockDefinition: {
      inputs: {
        model: { name: 'Jane Doe' },  // only this is overridden; rows, services, etc. unchanged
      },
    },
  },
  blockDefinitions: { UserCard: userCardBlock },
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
| `description` | `unknown \| null` | Full block description, or block reference `{ id }` / `{ blockId, blockDefinition? }` when using `blockDefinitions`. |
| `outputHandlers` | `Record<string, (value: unknown) => void>` | Handlers for component outputs; keys match description `outputs`. |
| `blockRegistry` | `BlockRegistry \| null` | Registry for block instances by id; pass from root so nested blocks share it. |
| `blockDefinitions` | `Record<string, unknown> \| null` | Map id → full description; required when `description` is a block reference (id/blockId). |

Usage: host element with `[block]` and `[description]="desc"`. Optionally `[blockRegistry]="registry"`, `[blockDefinitions]="definitions"`, and `[outputHandlers]="handlers"`.

## BlockLoaderService API

| Method | Description |
|--------|-------------|
| `load(description, viewContainerRef, options?)` | Load a component from the description, build instance from self-scoped services, seed model, resolve inputs, wire outputs, register by id. Returns `Promise<BlockLoadResult>`. |

**BlockLoadOptions:** `outputHandlers?`, `registry?`, `blockDefinitions?` (id → full description; used when description is a block reference).

**BlockLoadResult:** `componentRef`, `destroy()` (unregister, unsubscribe outputs, remove view, destroy component), `updateInputs(description)` (re-parse and set inputs from a new description).

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
            inputs: { label: 'First name', value: '[(MyForm.instance.FormState.firstName)]' },
          },
        ],
      },
    ],
  },
};

// In template (e.g. BlockHost):
// <div block [description]="block" [blockRegistry]="getRegistry()"></div>
```

### Example 2: Reuse by id (no overrides)

Register the block in `blockDefinitions` and reference it by `id` or `blockId`. Same block, same data every time.

```typescript
// Define once, export for registration
const personFormBlock = {
  component: 'RowLayout',
  id: 'PersonForm',
  services: [{ id: 'FormState', scope: 'self' as const }],
  inputs: {
    model: { firstName: 'Jane', lastName: 'Doe', age: 28 },
    rows: [/* ... */],
  },
};

// Route: reuse by id
const route = {
  path: 'person',
  component: 'BlockHost',
  data: {
    block: { id: 'PersonForm' },
    blockDefinitions: { PersonForm: personFormBlock },
  },
};

// Host template must pass both
// [description]="blockDescription()" [blockDefinitions]="blockDefinitions()"
```

### Example 3: Reuse with overrides (deep merge)

Use the same layout/structure but override only specific properties (e.g. `inputs.model`). Other keys (rows, services, component) stay from the base.

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
          { component: 'HtmlBlock', inputs: { html: '{{UserCard.instance.FormState.name}}' } },
        ],
      },
      {
        columns: [
          { component: 'StringInput', inputs: { label: 'Name', value: '[(UserCard.instance.FormState.name)]' } },
          { component: 'StringInput', inputs: { label: 'Email', value: '[(UserCard.instance.FormState.email)]' } },
        ],
      },
    ],
  },
};

// Usage A: same card, different initial model (only inputs.model is overridden)
const blockWithOverride = {
  blockId: 'UserCard',
  blockDefinition: {
    inputs: {
      model: { name: 'Jane Doe', email: 'jane@example.com' },
    },
  },
};

// Usage B: override multiple top-level keys (e.g. id for this instance, and model)
const blockWithIdAndModel = {
  blockId: 'UserCard',
  blockDefinition: {
    id: 'UserCardInstance1',
    inputs: {
      model: { name: 'John', email: 'john@example.com' },
    },
  },
};

// Register and pass to directive
const blockDefinitions = { UserCard: userCardBlock };
// <div block [description]="blockWithOverride" [blockDefinitions]="blockDefinitions" [blockRegistry]="registry()"></div>
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
      block: { id: 'PersonForm' },
      blockDefinitions: { PersonForm: personFormBlock },
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
    [blockRegistry]="getRegistry()"
    [blockDefinitions]="blockDefinitions()">
  </div>
} @else {
  <p>No block in route data.</p>
}
```

### Example 5: Programmatic load (BlockLoaderService)

When loading blocks from code (e.g. dynamic slot or modal):

```typescript
// Id-only
await this.loader.load(
  { id: 'PersonForm' },
  viewContainerRef,
  { registry: this.registry, blockDefinitions: { PersonForm: personFormBlock } }
);

// With overrides
await this.loader.load(
  {
    blockId: 'UserCard',
    blockDefinition: { inputs: { model: { name: 'Jane', email: 'jane@example.com' } } },
  },
  viewContainerRef,
  { registry: this.registry, blockDefinitions: { UserCard: userCardBlock } }
);
```

### Deep merge behavior (blockDefinition)

- **Objects** are merged by key. Only keys present in `blockDefinition` override the base; others are unchanged. Example: `blockDefinition: { inputs: { model: {...} } }` replaces only `inputs.model` and keeps `inputs.rows`, `inputs.columns`, etc.
- **Arrays** in `blockDefinition` replace the base array entirely (no element-wise merge).
- **Primitives** in `blockDefinition` replace the base value.
