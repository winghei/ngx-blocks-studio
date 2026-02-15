# Block loader

The block loader renders Angular components from a **JSON description**. It resolves **instance refs** (e.g. `instance.FormState.firstName` or `UserForm.instance.FormState.firstName`), wires **inputs** and **outputs**, and optionally registers block instances by **id** in a **BlockRegistry** so refs can target other blocks in the tree.

**Source:** `projects/blocks-studio/src/lib/core/block-loader/`

## Source layout

```
projects/blocks-studio/src/lib/core/block-loader/
├── index.ts                    # Public exports
├── block-description.schema.ts # BlockDescription (Zod), parse/safeParse, normalizeServices, isOutputReference
├── block-registry.ts           # BlockRegistry, BlockInstanceHandle, BlockRegistryImpl
├── ref-expressions.ts          # parseRefPath, extractReadonlyRefs, isTwoWayRefString, parseTwoWayRef
├── ref-resolver.ts             # ResolverContext, resolveRefPath, getRefValue, setRefValue, buildComputedForTemplate
├── output-reference.ts         # resolveOutputReference, createOutputHandler (reference vs directive handler)
├── block-loader.service.ts     # BlockLoaderService
└── block.directive.ts          # BlockDirective
```

## Overview

- **BlockDirective** – Renders one block from a description; use `[block]` with `[description]="desc"` and optionally `[blockRegistry]="registry"` so nested blocks share the same registry.
- **BlockLoaderService** – Validates the description, resolves the component (via [ComponentRegistry](registry.md)), builds a child injector for self-scoped services, creates the component, builds **instance** (services/state by name), seeds **model** from `inputs.model` if present, resolves inputs (refs or literals), wires outputs (reference-based or directive-provided), and registers/unregisters by **id**.
- **BlockRegistry** – One registry per tree; maps block **id** to a handle with **instance** (and optional **destroy**). Duplicate id in the same tree throws.

## Description shape

| Property   | Type     | Required | Description |
|------------|----------|----------|-------------|
| `component` | `string` | Yes | Component key (resolved via [ComponentRegistry](registry.md)). |
| `id`       | `string` | No  | Unique id for this block; used for registry and cross-block refs. At most one per id per tree. |
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

## BlockDirective API

| Input | Type | Description |
|-------|------|-------------|
| `description` | `unknown \| null` | JSON description for the block to render. |
| `outputHandlers` | `Record<string, (value: unknown) => void>` | Handlers for component outputs; keys match description `outputs`. |
| `blockRegistry` | `BlockRegistry \| null` | Registry for block instances by id; pass from root so nested blocks share it. |

Usage: host element with `[block]` and `[description]="desc"`. Optionally `[blockRegistry]="registry"` and `[outputHandlers]="handlers"`.

## BlockLoaderService API

| Method | Description |
|--------|-------------|
| `load(description, viewContainerRef, options?)` | Load a component from the description, build instance from self-scoped services, seed model, resolve inputs, wire outputs, register by id. Returns `Promise<BlockLoadResult>`. |

**BlockLoadOptions:** `outputHandlers?`, `registry?`.

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
