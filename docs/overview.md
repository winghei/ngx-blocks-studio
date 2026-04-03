# What is ngx-blocks-studio?

**ngx-blocks-studio** is an Angular library for **config-driven routing** and **block-based UIs**. You register components, guards, and services by name, describe screens as data (JSON-like objects), and wire inputs, outputs, and cross-block state with **reference paths**—so product and tooling can drive the UI without hand-written templates for every variant.

It complements [Angular](https://angular.dev/overview): you still use the router, dependency injection, and standalone components; the library adds **registries**, **block descriptions**, and optional **dynamic route loading** from JSON or in-memory config.

---

## Features that power schema-driven apps

### Registries

Register **components**, **directives**, **guards**, and **services** by string key. Resolve them at runtime (with optional lazy loaders) and attach **metadata** in one shared store. Used by the route loader and block loader to turn config into real Angular types.

[→ Registry](core/registry.md)

### Config-driven routing

Load **`Routes`** from a JSON file or a `RouteConfigs` object. Components and guards are referenced by **keys** that must be registered before loading. Config is exposed as **signals** for reactive use.

[→ Route loader](core/router-loader.md)

### Block descriptions

Render a component tree from a **block description**: `component` key, optional `id`, `services`, `directives` (host directives), `inputs`, `outputs`. Supports **literal values**, **read-only** `{{ refPath }}` interpolation, **two-way** `[( refPath )]` to writable signals, **nested** rows/columns, and **reuse** via `blockId` and deep-merge **overrides**.

[→ Block loader](core/block-loader.md)

### Bindings and cross-block refs

Connect inputs to shared or per-block state without boilerplate. Reference paths can target the **current block**, a **named block** in the same registry, or—with **scoped registries**—another scope’s registry.

[→ Block-directive use cases](block-directive-use-cases.md) · [Concepts → Ref paths](concepts.md#reference-paths)

### Services and model

Declare **root-scoped** or **self-scoped** services per block. Pass a **model** via the directive’s `[model]` input or the **`model` signal** to **`load()`**; **`blockInstance.model`** is set from that signal. **`setModel()`** is invoked in the **self-scoped** path when the service exposes a **`model` signal**—see [Services and model](core/block-loader.md#services-and-model). `inputs.model` in the description is **not** used by the loader.

[→ Use cases → Services](block-directive-use-cases.md#2-services)

### Outputs as data

Wire **`outputs`** with **callable ref strings** or **`{ ref, params?, then?, onError? }`** objects (see [Outputs](core/block-loader.md#outputs-callable-refs)). There is no separate **`outputHandlers`** API—invalid values become no-ops.

[→ Outputs](core/block-loader.md#outputs-as-reference)

---

## Learning path: from simple to advanced

Follow these steps in order. Each step links to deeper docs.

| Step | Goal | Read next |
|------|------|-----------|
| **1** | Resolve a component by name | [Registry → ComponentRegistry](core/registry.md#componentregistry) |
| **2** | Load routes from data (JSON or object) | [Route loader](core/router-loader.md) |
| **3** | Render one block with `[block]` | [Block loader → BlockDirective](core/block-loader.md#blockdirective-api) |
| **4** | Use literals, self-scoped services, and `model` / `setModel` | [Use cases §1–2](block-directive-use-cases.md#1-input-bindings) |
| **5** | Read-only bindings with `{{ refPath }}` | [Use cases §1.2](block-directive-use-cases.md#12-read-only-refs-refpath) |
| **6** | Two-way form state with `[( refPath )]` | [Use cases §1.3](block-directive-use-cases.md#13-two-way-refs--refpath-) |
| **7** | Reuse blocks with `blockId` and `blockDefinitions` / overrides | [Use cases §4](block-directive-use-cases.md#4-block-references-reuse-and-overrides) |
| **8** | Output reference handlers and async chaining | [Use cases §5](block-directive-use-cases.md#5-output-handlers) |
| **9** | Host directives, programmatic `BlockLoaderService`, scoped registries | [Block loader](core/block-loader.md) · [Concepts → Scopes](concepts.md#scoped-block-registries) |

---

## Concepts at a glance

Short definitions of terms used across the docs: **block vs route**, **component key**, **`blockId` vs instance `id`**, and **ref path** shapes (including scoped refs).

[→ Concepts](concepts.md)

---

## Try it in the repo

The **`projects/demo`** application registers blocks, loads routes with **`RouteLoader`** in `app.config.ts`, and stores example block data under **`projects/demo/src/app/route-data/`**. Run `ng serve demo` from the workspace root after linking or building the library.

---

## Tests

Block-directive behavior is covered by **`npm run test:block-directives`** (Vitest). See **`tests/block-directives/README.md`**.

---

[← Documentation index](README.md)
