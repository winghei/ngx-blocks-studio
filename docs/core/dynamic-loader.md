# Dynamic component loader

The dynamic loader loads Angular components from a **JSON descriptor**, sets **blockData** (signals/computed) from the descriptor’s **model**, and optionally registers block instances by **id** in a **registry** so that model expressions like `{{RegistrationForm.firstName}}` and `[(RegistrationForm.firstName)]` resolve across the tree.

**Source:** `projects/blocks-studio/src/lib/core/dynamic-loader/`

## Source layout

```
projects/blocks-studio/src/lib/core/dynamic-loader/
├── index.ts                          # Public exports
├── dynamic-component-descriptor.ts   # Descriptor schema (Zod), parse/safeParse
├── dynamic-block-registry.ts        # DynamicBlockRegistry, BlockInstanceHandle, DynamicBlockRegistryImpl
├── model-expressions.ts             # Expression parse ({{}}, [()]), parseRef, extractReadonlyRefs
├── model-resolver.ts                # resolvePath, resolveRef, getWritableAtPath, writeBackAtPath
├── model-parser.ts                  # buildBlockData (blockData + blockEffect cleanups)
├── dynamic-component-loader.service.ts  # DynamicComponentLoaderService
└── dynamic-component.directive.ts  # BlockDirective
```

## Overview

- **BlockDirective** – Renders one block from a descriptor; use `[block]="descriptor"` and optionally `[blockRegistry]="registry"` so nested blocks share the same registry.
- **DynamicComponentLoaderService** – Loads a component by descriptor, builds **blockData** from **model** (with `{{}}` readonly and `[()]` two-way refs), sets **input** (e.g. rows/columns for layout), and registers/unregisters by **id**.
- **DynamicBlockRegistry** – One registry per tree; maps block **id** → instance handle (blockData). Duplicate id in the same tree throws.
- **buildBlockData** – Parses **model** and returns `blockData` (signals/computed) and effect cleanups for two-way bindings.

## Descriptor shape

| Property   | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `component` | `string` | Yes | Component key (resolved via [ComponentRegistry](registry.md#componentregistry)). |
| `id`      | `string` | No  | Unique id for this block instance; used for registry and model refs. At most one instance per id per tree. |
| `model`   | `unknown` | No  | Combined input/output state; may be primitives, object, or strings with `{{RefId.path}}` (readonly) / `[(RefId.path)]` (two-way). |
| `input`   | `Record<string, unknown>` | No | Component inputs; may include `rows` / `columns` arrays of **child descriptors** for layout components. |
| `output`  | `string[]` | No | Output names to subscribe to; handlers provided at load time. |
| `services` | (see descriptor schema) | No | Self-scoped services for the block. |

Nested blocks: layout components receive `input` (e.g. `input.rows`, `input.columns`) and render each child with `[block]="childDescriptor"` and `[blockRegistry]="blockRegistry()"` so the same registry is used.

### BlockDirective API

| Input | Type | Description |
|-------|------|-------------|
| `block` | `unknown \| null` | JSON descriptor for the block to render. |
| `outputs` | `Record<string, (value: unknown) => void>` | Handlers for component outputs; keys match descriptor `output` names. |
| `blockRegistry` | `DynamicBlockRegistry \| null` | Registry for block instances by id; pass from root so nested blocks share it. |

### DynamicComponentLoaderService API

| Method | Description |
|--------|-------------|
| `load(descriptor, viewContainerRef, options?)` | Load a component from the descriptor, build blockData from model, set input, optionally register by id. Returns `Promise<DynamicComponentLoadResult>`. |

**DynamicComponentLoadOptions:** `outputs?`, `registry?` (block registry for this tree).

**DynamicComponentLoadResult:** `componentRef`, `destroy()` (unregister id, run effect cleanups, remove view, destroy component), `updateInputs(descriptor)` (update inputs from a new descriptor).

### buildBlockData API

| Parameter | Description |
|-----------|-------------|
| `model` | The descriptor’s model (primitives, object, or strings with `{{}}` / `[()]`). |
| `options` | `{ getBlock: (id: string) => BlockInstanceHandle \| undefined }` – used to resolve refs. |

**Returns:** `{ blockData, blockEffectCleanups }`. Must be run in an injection context (e.g. via `runInInjectionContext(componentRef.injector, () => buildBlockData(...))`) so `effect()` is tied to the component.

## Block registry

- **One registry per tree** – Create a `DynamicBlockRegistryImpl` (or implement `DynamicBlockRegistry`) at the root and pass it to the root `[block]` via `[blockRegistry]`.
- **Id uniqueness** – Each **id** may occur at most once in the same registry. Registering the same id twice throws.
- **Lifecycle** – When a block with an **id** is created, the loader registers it; when the block is destroyed, the loader unregisters it.

| Method | Description |
|--------|-------------|
| `register(id, handle)` | Register a block by id. Throws if id is already registered. |
| `unregister(id)` | Unregister when the block is destroyed. |
| `get(id)` | Get handle by id. |
| `has(id)` | Whether id is registered. |

**BlockInstanceHandle:** `{ blockData: Record<string, Signal<unknown> \| unknown> \| Signal<unknown>; destroy?: () => void }` – used for expression resolution.

## Model expression syntax

- **Allowed model values:** number, string, boolean, or nested object whose values are number, string, boolean, or nested object.
- **Readonly:** `{{RefId.path.to.prop}}` – computed that reads from the referenced block’s blockData at the path. If the value at the path is a signal, it is called when reading.
- **Two-way:** `[(RefId.path.to.prop)]` – full string value only. If the target is a writable signal, this block’s blockData is that signal; otherwise a local signal is created and an effect writes back to the target.
- **Disallowed:** A string that *contains* a writable ref but is not *exactly* a writable ref (e.g. `"Hello [(RegistrationForm.firstName)]"` as an object value) is rejected (case 5).

### Model cases (blockData / blockEffect)

| Case | Model | blockData | blockEffect |
|------|--------|-----------|-------------|
| 1 | `{ firstName: 'John', lastName: 'Doe' }` | `signal({ firstName: 'John', lastName: 'Doe' })` | — |
| 2 | `'Hi {{RegistrationForm.firstName}}'` | `computed(() => 'Hi ' + resolve(RegistrationForm, 'firstName'))` | — |
| 3 | `'[(RegistrationForm.firstName)]'` | If target is signal: same signal ref; else: `computed` + local signal | If target not signal: effect that writes back |
| 4 | `{ firstName: '[(RegistrationForm.firstName)]' }` (key-value) | `blockData.firstName` = same as case 3 | Same as case 3 for that key |
| 5 | `{ Title: "Hello [(RegistrationForm.firstName)]" }` | **Disallowed** – writable ref inside object string value | — |
| 6 | `{ Title: "Hello {{RegistrationForm.firstName}}", lastName: "Hi" }` | `Title`: computed; `lastName`: signal `"Hi"` | — |
| 7 | `{ user: "[(RegistrationForm)]", text: "Hi {{RegistrationForm.firstName}}" }` | `user`: ref to whole RegistrationForm.blockData; `text`: computed | — |

Examples in text:

- `model: { firstName: 'John', lastName: 'Doe' }` → `blockData = signal({ firstName: 'John', lastName: 'Doe' })`.
- `model: 'Hi {{RegistrationForm.firstName}}'` → `blockData = computed(() => 'Hi ' + resolve(RegistrationForm, 'firstName'))`.
- `model: '[(RegistrationForm.firstName)]'` → two-way: same signal ref or computed + write-back effect.
- `model: { Title: "Hello {{RegistrationForm.firstName}}", lastName: "Hi" }` → Title computed, lastName signal.
- Layout components must pass **blockRegistry** to child `[block]` so refs resolve.

## Layout contract

Layout components (e.g. column-layout, row-layout) that render nested descriptors must:

1. Receive `input` (with `rows`, `columns`, etc.) and optionally **blockRegistry** (e.g. as an input from the parent).
2. For each child descriptor in `input.rows` / `input.columns`, render with the **BlockDirective** and pass the same registry:  
   `<ng-container [block]="child" [blockRegistry]="blockRegistry()">`.

If the root host does not pass a registry, the loader uses a transient registry for that load only; nested children will not share refs unless the layout passes a registry.

## Full descriptor example

Example JSON for a registration form with nested layout and two-way bindings:

```json
{
  "model": { "firstName": "John", "lastName": "Doe" },
  "id": "RegistrationForm",
  "component": "column-layout",
  "input": {
    "rows": [
      { "component": "header", "input": { "innerHTML": "Welcome" } },
      {
        "component": "row-layout",
        "input": {
          "columns": [
            { "component": "string-input", "model": "[(RegistrationForm.firstName)]" },
            { "component": "string-input", "model": "[(RegistrationForm.lastName)]" }
          ]
        }
      }
    ]
  }
}
```

- The root has `id: "RegistrationForm"` and `model: { firstName, lastName }`, so its `blockData` is a signal holding that object and the block is registered under `RegistrationForm`.
- Child `string-input` descriptors use `model: "[(RegistrationForm.firstName)]"` so their `blockData` is two-way bound to the root’s `blockData.firstName` (and similarly for `lastName`).
- Layout components (`column-layout`, `row-layout`) receive `input` with `rows` / `columns` and must render each child with `[block]="child"` and `[blockRegistry]="blockRegistry()"`.

## Usage examples

### Root host: create registry and pass to root block

```typescript
import { Component, signal } from '@angular/core';
import { BlockDirective, DynamicBlockRegistryImpl } from 'ngx-blocks-studio';

@Component({
  selector: 'app-form-host',
  standalone: true,
  imports: [BlockDirective],
  template: `
    <ng-container
      [block]="descriptor()"
      [blockRegistry]="blockRegistry()"
      [outputs]="outputHandlers">
    </ng-container>
  `,
})
export class FormHostComponent {
  private readonly registry = new DynamicBlockRegistryImpl();
  blockRegistry = signal<DynamicBlockRegistryImpl | null>(this.registry);
  descriptor = signal(registrationFormDescriptor);
  outputHandlers = { submitted: (v: unknown) => console.log('submitted', v) };
}
```

Create one `DynamicBlockRegistryImpl` per form/page and pass it to the root `[block]` via `[blockRegistry]`.

### Layout component: pass blockRegistry to child blocks

```typescript
import { Component, input } from '@angular/core';
import { BlockDirective } from 'ngx-blocks-studio';
import type { DynamicBlockRegistry } from 'ngx-blocks-studio';

@Component({
  selector: 'app-column-layout',
  standalone: true,
  imports: [BlockDirective],
  template: `
    <div class="column">
      @for (row of input()?.rows ?? []; track $index) {
        <ng-container
          [block]="row"
          [blockRegistry]="blockRegistry()">
        </ng-container>
      }
    </div>
  `,
})
export class ColumnLayoutComponent {
  input = input<{ rows?: unknown[] }>();
  blockRegistry = input<DynamicBlockRegistry | null>(null);
}
```

Layout components must receive `blockRegistry` (e.g. as an input from the parent) and pass it to each child `[block]` so refs like `{{RegistrationForm.firstName}}` and `[(RegistrationForm.firstName)]` resolve.

## Public exports

From the dynamic-loader module:

- **DynamicComponentDescriptorSchema**, **DynamicComponentDescriptor**, **ServiceEntry**, **parseDynamicComponentDescriptor**, **safeParseDynamicComponentDescriptor**
- **DynamicBlockRegistry**, **BlockInstanceHandle**, **DynamicBlockRegistryImpl**
- **buildBlockData**, **BuildBlockDataOptions**, **BuildBlockDataResult**
- **DynamicComponentLoaderService**, **DynamicComponentLoadOptions**, **DynamicComponentLoadResult**
- **BlockDirective**

[← Documentation index](../README.md)
