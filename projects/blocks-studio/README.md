# ngx-blocks-studio

Angular library for **config-driven routing** and **block-based UIs**. Define routes and component trees in JSON; the library resolves components and guards by name and wires inputs, outputs, and cross-block references.

## What it does

- **Registries** — Register components, guards, and services by string key. Used by the route and block loaders to resolve types at runtime. Optional lazy loading and a shared metadata store.
- **Block loader** — Render components from a JSON description. Supports instance refs (e.g. `FormState.firstName`), two-way binding via refs, nested blocks, optional **host directives** (via DirectiveRegistry), and a block registry so blocks can reference each other. Inputs and outputs are validated first (each key must exist on the component or a host directive; invalid keys are warned and skipped), then set/wired on all matching targets. Use full descriptions or reuse definitions by `blockId` with overrides.
- **Route loader** — Load route configuration from JSON (or a URL). Components and guards are resolved by key; the resulting `Routes` are applied to the router. Config is exposed as signals.

## Docs

Full API and usage:

- [Registry](../../docs/core/registry.md) — ComponentRegistry, GuardRegistry, ServiceRegistry, BlockDefinitionsRegistry, metadata
- [Block loader](../../docs/core/block-loader.md) — BlockDirective, descriptions, refs, inputs/outputs
- [Route loader](../../docs/core/router-loader.md) — RouteLoader, RouteConfig, loading from JSON/URL
