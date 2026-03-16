# Block-directive use cases

Quick reference for how block descriptions use **bindings**, **services**, **directive inputs/outputs**, **block references**, and **output handlers**. Each use case includes a short description and where it appears in the demo app.

**See also:** [Block loader](core/block-loader.md) (full behavior), [Registry](core/registry.md) (ComponentRegistry, DirectiveRegistry, ServiceRegistry).

---

## 1. Input bindings

### 1.1 Literal inputs

**Description:** Plain values (string, number, boolean, object, array) are set on the component (or host directive) as-is.

**Use case:** Static labels, placeholders, config objects, row/column layout data.

**Demo:** All blocks use literal `inputs` (e.g. `label: 'First name'`, `html: '<h2>Login</h2>'`, `rows` arrays).  
Files: `route-data/person-form.block.ts`, `route-data/login.block.ts`, `route-data/nav.block.ts`.

---

### 1.2 Read-only refs: `{{ refPath }}`

**Description:** A string containing `{{ refPath }}` is interpolated: each placeholder is replaced with the value at that path. Ref path is either **current block** (`serviceOrModel.path` or `model.path`, e.g. `FormState.firstName`, `model.age`) or **named block** (`BlockID:serviceOrModel.path`, e.g. `PersonForm:FormState.firstName`). If the ref does not resolve to a service/model instance, the loader falls back to reading from the block’s `model` value by dot path. A computed signal keeps the value in sync when refs (e.g. signals) change.

**Use case:** Display state from a service, the current block model, or another block without two-way binding.

**Demo:** Person form `HtmlBlock` shows `{{PersonForm:FormState.nestedSignal.sub.a}}`, `{{PersonForm:FormState.lastName}}`, `{{age}}`. Dashboard shows `{{DashboardPage:DashboardState.note}}`.  
Files: `route-data/person-form.block.ts`, `route-data/dashboard.block.ts`.

---

### 1.3 Two-way refs: `[( refPath )]`

**Description:** The **entire** input value must be exactly `"[(refPath)]"`. The loader (1) sets the initial value from the ref, (2) syncs ref → component when the ref’s signal changes, (3) syncs component → ref when the component’s **writable signal/input** changes. No mixing with literals or `{{ }}`. If the target ref is not a writable signal, the loader logs a warning and degrades to one-way (read-only) input for that key.

**Use case:** Form controls bound to a shared state service (e.g. `StringInput`/`NumberInput` value bound to `FormState.firstName`, `FormState.age`).

**Demo:** Person form and login/dashboard use `value: '[(PersonForm:FormState.firstName)]'`, `value: '[(LoginPage:AuthState.username)]'`, `value: '[(DashboardPage:DashboardState.note)]'`.  
Files: `route-data/person-form.block.ts`, `route-data/login.block.ts`, `route-data/dashboard.block.ts`.

---

## 2. Services

### 2.1 Root-scoped services

**Description:** `services: ['ServiceId']` or `services: [{ id: 'ServiceId', alias?: 'Alias' }]` (no `scope`). Resolved from the **root injector** (e.g. the one used when the directive runs). If Angular returns an instance, that instance is used and no self-scoped instance is created for that id. If Angular does **not** provide a service for that id, the loader automatically falls back to creating a self-scoped instance for that id. One root instance per app (or per injector tree), plus additional self instances per block when needed.

**Use case:** Shared app-wide state (e.g. auth, theme). Person form uses root `FormState` so the same instance is used when provided by DI, otherwise a self-scoped instance is created.

**Demo:** Person form uses `services: [{ id: 'FormState' }]` (root-first, then self fallback).  
File: `route-data/person-form.block.ts`.

---

### 2.2 Self-scoped services

**Description:** `services: [{ id: 'ServiceId', scope: 'self', alias?: 'Alias' }]`. A **new instance** is created per block via a child injector. The block’s instance holds that service so refs like `BlockID:ServiceId.prop` target this block’s instance only.

**Use case:** Per-page or per-form state (e.g. login form has its own `AuthState`, dashboard its own `DashboardState`, child block its own `FormState`).

**Demo:** Login: `services: [{ id: 'AuthState', scope: 'self' }]`. Dashboard: `services: [{ id: 'DashboardState', scope: 'self' }]`. Person form child `NumberInput` uses `services: [{ id: 'FormState', scope: 'self' }]` for a local FormState.  
Files: `route-data/login.block.ts`, `route-data/dashboard.block.ts`, `route-data/person-form.block.ts`.

---

### 2.3 Model and `setModel`

**Description:** The block’s **model** is not taken from `inputs.model` in the description. It comes from the directive’s `[model]` input or the `model` argument to `load()`. The loader sets `blockInstance['model']` and calls `setModel(model)` on every service in the instance that has that method (e.g. FormState, AuthState). If `[model]` is a **ref path string**, the loader binds to that ref’s signal so model stays reactive.

**Use case:** Passing route data or initial form data into state services; binding the block’s model to another block’s model via a ref.

**Demo:** Route data passes `model: { firstName: 'Jane', ... }`; BlockHost passes it to the directive; FormState receives it via `setModel`.  
Files: `route-data/person-form.block.ts` (route `data.model`), `blocks/block-host/block-host.component.ts`.

---

## 3. Host directives (directive inputs/outputs)

### 3.1 Registering directives

**Description:** Register directive types in **DirectiveRegistry** by id. In the block description, set `directives: ['DirectiveId']` or `directives: ['Id1', 'Id2']`. The loader resolves these ids to types and passes them as **host directives** when creating the component. The same flat `inputs` and `outputs` are applied to the **component and every host directive** that has that key.

**Use case:** Add behavior (e.g. tooltips, focus, drag) to the host without a wrapper component; allow inputs/outputs to target the directive.

**Demo:** The demo does not currently register any host directives in `directives`; the **BlockDirective** itself is the directive that renders the block. For a custom host directive you would: (1) `DirectiveRegistry.getInstance().register('MyDirective', MyDirective)` in app init, (2) add `directives: ['MyDirective']` and matching `inputs`/`outputs` in the block description.

---

### 3.2 Inputs/outputs on component and directives

**Description:** For each key in `inputs` (or `outputs`), the loader finds **all targets** that have that key: the component instance and any host directive instances. It resolves the value once and **sets it on every target** (or subscribes the same handler on every target). If a key exists only on a directive, only that directive receives it; if on both component and directive, both do.

**Use case:** One description drives both the component and host directives (e.g. `disabled`, `valueChange`).

**Reference:** [Block loader – Host directives and inputs/outputs](core/block-loader.md#host-directives-and-inputsoutputs).

---

## 4. Block references (reuse and overrides)

### 4.1 Reuse by `blockId` (no overrides)

**Description:** Instead of a full description, pass `{ blockId: 'X' }`. The loader looks up the definition for `X` in `blockDefinitions` (passed to the directive/loader) or the global **BlockDefinitionsRegistry**. Same block, same definition every time.

**Use case:** Reuse a shared block (e.g. nav, card) without duplicating the description.

**Demo:** Routes use `block: { blockId: 'PersonForm' }`, `block: { blockId: 'LoginPage' }`, `block: { blockId: 'DashboardPage' }`. Rows include `{ blockId: 'AppNav' }` so every page gets the same nav.  
Files: `route-data/person-form.block.ts`, `route-data/login.block.ts`, `route-data/dashboard.block.ts`, `route-data/nav.block.ts`, `app.config.ts` (registration).

---

### 4.2 Reuse with overrides: `blockDefinition`

**Description:** Pass `{ blockId: 'X', blockDefinition: { inputs: { ... } } }`. The loader resolves the base definition for `X`, then **deep-merges** `blockDefinition` on top. Only the keys you specify are changed; others (e.g. `rows`, `services`) stay from the base. **Note:** `inputs.model` in the description is ignored; pass model via `[model]` or `load(..., model, ...)`.

**Use case:** Same layout/structure, different data or a few overridden inputs per usage.

**Demo:** Comment in person-form route shows the pattern: `block: { blockId: 'PersonForm', blockDefinition: { inputs: { model: {...} } } }` (conceptually; actual model is passed via route `data.model`).  
File: `route-data/person-form.block.ts` (comment), [Block loader – Reusing blocks](core/block-loader.md#reusing-blocks-by-id-and-overriding).

---

## 5. Output handlers

### 5.1 Output as reference (call method on ref)

**Description:** In `outputs`, set the value to `{ type: 'reference', reference: 'RefPath', method: 'methodName', params?: [...] }`. When the output fires, the loader resolves `reference` (e.g. `PersonForm:FormState.age` or `FormState`), calls `method` on that target with `params` (or the emitted value if no params). Ref path can point to a service or a signal (e.g. `PersonForm:FormState.age` → signal’s `set`).

**Use case:** On value change, update a signal or call a service method (e.g. `age.set(value)`, `FormState.alert(msg)`).

**Demo:** Person form `NumberInput` uses `valueChange: { type: 'reference', reference: 'FormState', method: 'alert', params: ['Age changed to {{value}}'] }` and `valueChange: { type: 'reference', reference: 'PersonForm:FormState.age', method: 'set' }`.  
File: `route-data/person-form.block.ts`.

---

### 5.2 Output reference: `then` / `onSuccess` / `onError`

**Description:** When the method called by the output reference returns a **Promise**, you can add `then` (array of `{ reference, method, params? }`) or `onSuccess` / `onError` (single `{ reference, method, params? }`). These are invoked after the promise resolves or rejects.

**Use case:** Chaining async actions (e.g. save then navigate, or show error toast).

**Reference:** [Block loader – Output reference shape](core/block-loader.md#output-reference-shape).

---

### 5.3 Output via directive handler (`outputHandlers`)

**Description:** If the output value in the description is **not** a reference config (e.g. omitted or a plain value), the loader uses the **outputHandlers** map passed to the directive/loader (key = output name). If no handler is provided, it uses a no-op.

**Use case:** Custom imperative handling (e.g. analytics, focus) without defining a ref in the block description.

**Reference:** [Block loader – Outputs as reference](core/block-loader.md#outputs-as-reference), `createOutputHandler` in `output-reference.ts`.

---

## 6. Ref path format

| Form | Meaning | Example |
|------|--------|--------|
| `serviceOrModel.path` | Current block’s instance (service or model) and path | `FormState.firstName`, `model.age` |
| `BlockID:serviceOrModel.path` | Named block’s instance and path (block must have `id` and be in the same registry) | `PersonForm:FormState.firstName`, `LoginPage:AuthState.username` |

Single segment (e.g. `FormState`) resolves to the instance entry; with path (e.g. `FormState.firstName`) the last segment is the property (or signal) on the resolved target.

---

## Summary table

| Use case | Description | Demo location |
|----------|-------------|---------------|
| Literal inputs | Plain values set on component/directive | All block files |
| Read-only `{{ refPath }}` | Interpolation + reactive updates | person-form, dashboard |
| Two-way `[( refPath )]` | Sync component ↔ ref (e.g. form state) | person-form, login, dashboard |
| Root-scoped services | One instance from root injector | person-form `FormState` |
| Self-scoped services | New instance per block | login, dashboard, person-form child |
| Model / setModel | Model from `[model]` or `load(..., model)`; `setModel` on services | Route data, BlockHost |
| Host directives | `directives: ['Id']`, same inputs/outputs on component + directives | (Demo: none; see Block loader doc) |
| Block reference `blockId` | Reuse definition from registry | All routes, AppNav in rows |
| Block reference + blockDefinition | Deep-merge overrides onto base | (See block-loader.md examples) |
| Output reference | `type: 'reference'`, call method on ref (e.g. signal.set) | person-form valueChange |
| Output then/onSuccess/onError | Chained calls after promise | block-loader.md |
| outputHandlers | Custom handler per output name when not a reference | block-loader.md |

---

[← Documentation index](README.md)
