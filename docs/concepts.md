# Concepts

Short glossary for **ngx-blocks-studio**. For behavior details, see [Block loader](core/block-loader.md) and [Block-directive use cases](block-directive-use-cases.md).

---

## Block vs route vs component key

| Term | Meaning |
|------|--------|
| **Route** | A normal Angular `Route`: `path`, `component`, `data`, guards, `children`. In this library, the route’s `component` is often a **shell** (e.g. a host that renders a block from `data`). |
| **Component key** | String registered on **`ComponentRegistry`** (e.g. `'StringInput'`). Block descriptions use **`component: 'StringInput'`**; route config uses **`component: 'BlockHost'`** style keys—same registry. |
| **Block** | One UI unit described by a **block description** (or a **block reference**). The **`BlockDirective`** (`[block]`) uses **`BlockLoaderService`** to create the component, wire inputs/outputs, and register the instance by **`id`**. |

---

## `blockId` vs instance `id`

| Field | Role |
|-------|------|
| **`blockId`** | Key used to **look up** a stored definition in `blockDefinitions` or **`BlockDefinitionsRegistry`**. Used in references like `{ blockId: 'PersonForm' }`. |
| **`id`** | **Instance id** for this block in the **`BlockRegistry`**. Cross-block refs use this id in paths like `PersonForm:FormState.firstName`. Must be unique within a registry tree. |

You can reuse a definition (`blockId`) many times; each usage can set a different **`id`** when you need distinct instances (or omit and use the base definition’s id—see [Reusing blocks](core/block-loader.md#reusing-blocks-by-id-and-overriding)).

---

## Registries: three different things

| Registry | Purpose |
|----------|--------|
| **`ComponentRegistry`**, **`DirectiveRegistry`**, **`GuardRegistry`**, **`ServiceRegistry`** | Map **string keys** → Angular types or DI-backed services. Used when resolving `component`, `directives`, and route guards. |
| **`BlockDefinitionsRegistry`** | Global **`blockId` → full description** (or lazy loader). Fallback when a block reference is not in local `blockDefinitions`. |
| **`BlockRegistry`** (per tree) | Maps **instance `id`** → **`BlockInstanceHandle`** (services, model, etc.) so refs like `PersonForm:...` resolve. Usually a **`BlockRegistryImpl`** passed via **`[blockRegistry]`**. |
| **`BlockRegistryService`** (app singleton) | Holds **`root`** and optional **scoped** registries for advanced cross-scope refs (see below). |

---

## Reference paths

Refs appear in **`{{ path }}`** (read-only), **`[( path )]`** (two-way), and output **`reference`** fields.

### Current block

- **`serviceOrModel.path`** — e.g. `FormState.firstName`, `model.title`.
- Single segment (e.g. **`FormState`**) — the named entry on the **current** block instance.

### Another block in the same registry

- **`BlockId:serviceOrModel.path`** — e.g. `PersonForm:FormState.firstName`. The block **`PersonForm`** must be registered in the same **`BlockRegistry`** (or chained registry) used by the loader.

### Scoped block registries {#scoped-block-registries}

When you register extra registries with **`BlockRegistryService.setScopedRegistry(scopeKey, registry, parentScopeKey)`**, refs can target a block in that scope:

- **`ScopeKey/BlockId:serviceOrModel.path`**

Example: `listScope/ItemCard:FormState.title` — resolves **`BlockId`** `ItemCard` in the registry for **`listScope`**. The loader passes **`getRegistryForScope`** from **`BlockRegistryService`** into ref resolution.

If the scope is missing or the block id is not found, resolution fails (with a **warn-once** message in the console).

**See also:** `projects/blocks-studio/src/lib/core/block-loader/ref-resolver.ts` (`ResolverContext`, `resolveRefPath`).

---

## Validation

**`safeParseBlockDescription`** (Zod) validates a **single** block description object. The **root** block is validated when the directive or `load()` runs; **nested** child block objects (e.g. inside `inputs.rows`) are validated when **that** child is loaded by its own **`BlockDirective`**. **`outputs`** must use **`OutputValueSchema`** (string callable ref or `{ ref, ... }`)—legacy `{ type, reference, method }` objects are **not** accepted when parsing that block.

---

[← Overview](overview.md) · [Documentation index](README.md)
