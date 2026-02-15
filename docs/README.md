# Documentation

Central documentation for **ngx-blocks-studio**. All module and API docs live here so the repo has a single place for documentation.

## Structure

```
docs/
├── README.md           # This index
└── core/               # Core library documentation
    ├── registry.md     # ComponentRegistry, GuardRegistry, ServiceRegistry, metadata
    ├── dynamic-loader.md # BlockDirective, dynamic loader, block registry, model expressions
    └── router-loader.md # RouteLoader, RouteConfig, loading routes from JSON
```

## Contents

| Document | Description |
|----------|-------------|
| [Core → Registry](core/registry.md) | Component, guard, and service registries, unified metadata store, lazy loading |
| [Core → Dynamic loader](core/dynamic-loader.md) | BlockDirective, descriptor (id, input, model), block registry, {{}} / [()] model expressions, layout contract |
| [Core → Route loader](core/router-loader.md) | RouteLoader service, RouteConfig / RouteConfigFile, loading routes from JSON |

## Adding documentation

- **New core module**: Add a file under `docs/core/` (e.g. `docs/core/services.md`) and link it in this table.
- **New area**: Add a folder under `docs/` (e.g. `docs/guides/`) and a README or index there; link from this README.
- **Cross-links**: Use relative paths, e.g. `[Registry](core/registry.md)` from this file, or `[Documentation index](../README.md)` from a subfolder.

## Source code

Library source lives under `projects/blocks-studio/src/lib/`. Docs describe the public API and behavior; for file locations, see each doc’s “Source” or “Folder structure” section.
