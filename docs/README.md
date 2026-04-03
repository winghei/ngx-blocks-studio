# Documentation

Central documentation for **ngx-blocks-studio**. All module and API docs live here so the repo has a single place for documentation.

## Start here

| Document | Description |
|----------|-------------|
| [**Overview**](overview.md) | What the library is for, feature pillars, **learning path** (simple → advanced), demo and tests |
| [**Concepts**](concepts.md) | Glossary: blocks vs routes, `blockId` vs `id`, registries, **ref path** formats (including scoped refs) |

## Reference

| Document | Description |
|----------|-------------|
| [Block-directive use cases](block-directive-use-cases.md) | Bindings (literal, `{{ }}`, `[( )]`), services (root/self), directive I/O, block references, output handlers; demo file references |
| [Core → Registry](core/registry.md) | Component, directive, guard, and service registries, metadata, `BlockDefinitionsRegistry`, lazy loading |
| [Core → Block loader](core/block-loader.md) | `BlockDirective`, description shape, instance refs, host directives, outputs as reference, `BlockLoaderService` |
| [Core → Route loader](core/router-loader.md) | `RouteLoader`, `RouteConfig`, `RouteConfigs`, loading routes from JSON or in-memory config |

## Structure

```
docs/
├── README.md                    # This index
├── overview.md                  # Introduction + learning path (start here)
├── concepts.md                  # Glossary and ref path semantics
├── block-directive-use-cases.md # Use cases with demo references
└── core/
    ├── registry.md
    ├── block-loader.md
    └── router-loader.md
```

## Adding documentation

- **New core module**: Add a file under `docs/core/` and link it from this README and from [Overview](overview.md) if it is user-facing.
- **Cross-links**: Use relative paths, e.g. `[Registry](core/registry.md)`.

## Source code

Library source: `projects/blocks-studio/src/lib/`. Deep dives reference files under `projects/blocks-studio/src/lib/core/`.
