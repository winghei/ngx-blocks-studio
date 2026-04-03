# ngx-blocks-studio

Angular library for **config-driven routing** and **block-based UIs**. Define routes and component trees in data; the library resolves components and guards by name and wires inputs, outputs, and cross-block references.

## Documentation (read first)

| Doc | Purpose |
|-----|--------|
| [**Overview**](../../docs/overview.md) | Introduction, features, **learning path** (simple → advanced) |
| [**Concepts**](../../docs/concepts.md) | Glossary, ref paths, scoped registries |
| [Block-directive use cases](../../docs/block-directive-use-cases.md) | Bindings, services, outputs, reuse |

## What it does

- **Registries** — Register components, guards, directives, and services by string key. Used by the route and block loaders to resolve types at runtime. Optional lazy loading and a shared metadata store.
- **Block loader** — Render components from a block description. Supports instance refs, two-way binding via refs, nested blocks, optional **host directives** (via DirectiveRegistry), and a block registry so blocks can reference each other. Validates input/output keys against the component and host directives, then wires all matching targets. Full descriptions or reuse by **`blockId`** with overrides.
- **Route loader** — Load route configuration from JSON (or a URL). Components and guards are resolved by key; the resulting `Routes` are applied to the router. Config is exposed as signals.

## API reference

- [Registry](../../docs/core/registry.md) — ComponentRegistry, DirectiveRegistry, GuardRegistry, ServiceRegistry, BlockDefinitionsRegistry, metadata
- [Block loader](../../docs/core/block-loader.md) — BlockDirective, BlockLoaderService, descriptions, refs, outputs
- [Route loader](../../docs/core/router-loader.md) — RouteLoader, RouteConfig, RouteConfigs, JSON / in-memory loading
