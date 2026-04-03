# Block-directive use cases

Quick reference for how block descriptions use **bindings**, **services**, **directive inputs/outputs**, **block references**, and **output handlers**. Each use case includes a short description and where it appears in the demo app.

**See also:** [Documentation overview](overview.md) (learning path), [Concepts → Reference paths](concepts.md#reference-paths) (including **scoped** `ScopeKey/BlockId:...` refs), [Block loader](core/block-loader.md) (full behavior), [Registry](core/registry.md) (ComponentRegistry, DirectiveRegistry, ServiceRegistry).

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

**Description:** The block’s **model** is not taken from `inputs.model` in the description. It comes from the directive’s `[model]` input or the **`model` signal** passed to **`load()`**. The loader sets **`blockInstance.model`** (a signal). **Root-scoped** services resolved from the injector are stored as-is on **`blockInstance.services`** (no automatic `setModel`). For **self-scoped** services, if the instance has a **`model` writable signal**, the loader may set it and call **`setModel()`** when a model value is present. If `[model]` is a **ref path string** (or contains templates), the loader resolves it to a reactive signal.

**Use case:** Passing route data or initial form data into state services; binding the block’s model to another block’s model via a ref.

**Demo:** Route data passes `model: { firstName: 'Jane', ... }`; BlockHost passes it to the directive.  
Files: `route-data/person-form.block.ts` (route `data.model`), `blocks/block-host/block-host.component.ts`.

**Reference:** [Block loader – Services and model](core/block-loader.md#services-and-model).

---

## 3. Host directives (directive inputs/outputs)

### 3.1 Registering directives

**Description:** Register directive types in **DirectiveRegistry** by id. In the block description, set `directives: ['DirectiveId']` or `directives: ['Id1', 'Id2']`. The loader resolves these ids to types and passes them as **host directives** when creating the component. The same flat `inputs` and `outputs` are applied to the **component and every host directive** that has that key.

**Use case:** Add behavior (e.g. tooltips, focus, drag) to the host without a wrapper component; allow inputs/outputs to target the directive.

**Demo:** The demo does not currently register any host directives in `directives`; the **BlockDirective** itself is the directive that renders the block. For a custom host directive you would: (1) `DirectiveRegistry.getInstance().register('MyDirective', MyDirective)` in app init, (2) add `directives: ['MyDirective']` and matching `inputs`/`outputs` in the block description.

---

### 3.2 Inputs/outputs on component and directives

**Description:** For each key in `inputs` (or `outputs`), metadata lists which **public input/output names** exist on the component and each host directive. The loader resolves each value once and applies the same **input** / **two-way** / **output** bindings to **every** target that declares that name. If a key exists only on a directive, only that directive receives it; if on both component and directive, both do.

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

## 5. Outputs (callable refs)

Each `outputs` entry must match **`BlockDescriptionSchema`**: a **string** callable ref, or an **`OutputCallObject`** with at least **`ref`**. The **last dot-separated segment** of the callable path is the **method name** (see `splitCallableRef` in `output-reference.ts`). There is **no** `outputHandlers` map on the directive or loader—unknown or missing shapes yield a **no-op** handler.

**Reference:** [Block loader – Outputs (callable refs)](core/block-loader.md#outputs-callable-refs).

### 5.1 String or `ref` object

**Description:** Use a string such as `"PersonForm:FormState.age.set"` or an object `{ "ref": "FormState.alert", "params": ["Age changed to {{value}}"] }`. Params support template interpolation with the event payload.

**Use case:** On value change, call `set` on a signal, or `alert` on a service.

**Demo:** See `route-data/person-form.block.ts` for examples (migrate legacy `{ type, reference, method }` shapes to a single **`ref`** string when validating nested blocks).

---

### 5.2 `then` and `onError`

**Description:** On an **`OutputCallObject`**, optional **`then`** runs after the main call (and after a returned **Promise** settles). Steps use the same **callable `ref`** strings or nested step objects. **`onError`** runs when the main promise rejects.

**Use case:** Chaining async actions (e.g. save then navigate, or error toast).

**Reference:** [Block loader – Outputs](core/block-loader.md#outputs-callable-refs).

---

### 5.3 Invalid or missing output config

**Description:** If the output value is **not** a non-empty string and **not** an object with a **`ref`** field, **`createOutputHandler`** returns a **no-op**. Omitted output keys are not wired.

**Reference:** `createOutputHandler` in `output-reference.ts`, `resolveBlockInputsAndOutputs` in `block-bindings.ts`.

---

## 6. Ref path format

| Form | Meaning | Example |
|------|--------|--------|
| `serviceOrModel.path` | Current block’s instance (service or model) and path | `FormState.firstName`, `model.age` |
| `BlockID:serviceOrModel.path` | Named block’s instance and path (block must have `id` and be in the same registry) | `PersonForm:FormState.firstName`, `LoginPage:AuthState.username` |
| `ScopeKey/BlockID:serviceOrModel.path` | Block in a **scoped** registry registered on `BlockRegistryService` | `listScope/ItemCard:FormState.title` |

Single segment (e.g. `FormState`) resolves to the instance entry; with path (e.g. `FormState.firstName`) the last segment is the property (or signal) on the resolved target. Scoped refs require `setScopedRegistry` on **`BlockRegistryService`**; see [Concepts](concepts.md#scoped-block-registries).

---

## Summary table

| Use case | Description | Demo location |
|----------|-------------|---------------|
| Literal inputs | Plain values set on component/directive | All block files |
| Read-only `{{ refPath }}` | Interpolation + reactive updates | person-form, dashboard |
| Two-way `[( refPath )]` | Sync component ↔ ref (e.g. form state) | person-form, login, dashboard |
| Root-scoped services | One instance from root injector | person-form `FormState` |
| Self-scoped services | New instance per block | login, dashboard, person-form child |
| Model / `blockInstance.model` | Model from `[model]` / `load(..., model signal)`; **`setModel`** mainly for self-scoped services with a `model` signal | Route data, BlockHost |
| Host directives | `directives: ['Id']`, same bindings on component + host directives | (Demo: none; see Block loader doc) |
| Block reference `blockId` | Reuse definition from registry | All routes, AppNav in rows |
| Block reference + blockDefinition | Deep-merge overrides onto base | (See block-loader.md examples) |
| Output callable ref | String `Block:path.method` or `{ ref, params?, then?, onError? }` | person-form `valueChange` (see schema) |
| Output `then` / `onError` | Chained steps after promise resolve/reject | block-loader.md |
| Invalid output value | No-op handler | block-loader.md |
| Scoped ref `ScopeKey/BlockId:...` | Cross-scope block refs via `BlockRegistryService` | [Concepts](concepts.md#scoped-block-registries), block-loader.md |

---

[← Documentation index](README.md)
