# Route loader

The route loader loads route configuration from a JSON file (or URL), resolves **components** and **guards** by name via [ComponentRegistry](registry.md#componentregistry) and [GuardRegistry](registry.md#guardregistry), and applies the resulting Angular `Routes` to the router. All route config is exposed as **signals** for reactive access.

**Source:** `projects/blocks-studio/src/lib/core/services/router-loader.service.ts`

## Overview

- **RouteLoader** – Injectable service that fetches a route config file, converts each entry into an Angular `Route` (with lazy-loaded components and resolved guards), and calls `Router.resetConfig(routes)`.
- **RouteConfig** – Per-route definition: path, component key, optional title, guard keys (`canActivate`, `canDeactivate`, etc.), `data`, and nested `children`.
- **RouteConfigs** – Config shape: `routes` array plus optional `defaultRedirect` and `catchAllRedirect`. Used for the top-level file and for each route’s `children` (so child segments can have their own redirects).

Components and guards are referenced by **string keys**. Before calling `loadRoutes()`, register every component and guard key used in the config with `ComponentRegistry` and `GuardRegistry` respectively.

## RouteConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | `string` | Yes | Route path. |
| `component` | `string` | Yes | Component key to load via ComponentRegistry. Must be registered before loading routes. |
| `title` | `string` | No | Route title. |
| `canActivate` | `string[]` | No | Guard keys for `canActivate` (resolved via GuardRegistry). |
| `canDeactivate` | `string[]` | No | Guard keys for `canDeactivate`. |
| `canLoad` | `string[]` | No | Guard keys for `canLoad`. |
| `canMatch` | `string[]` | No | Guard keys for `canMatch`. |
| `canActivateChild` | `string[]` | No | Guard keys for `canActivateChild`. |
| `outlet` | `string` | No | Named outlet. |
| `pathMatch` | `'full' \| 'prefix'` | No | Path match strategy. |
| `runGuardsAndResolvers` | `RunGuardsAndResolvers` | No | When to run guards and resolvers. |
| `data` | `Record<string, any>` | No | Static data for the route (merged with `component` key in `route.data`). |
| `children` | `RouteConfigs` | No | Nested routes plus optional `defaultRedirect` and `catchAllRedirect` for this segment. |

## RouteConfigs

Same shape for the **top-level config file** and for each route’s **`children`** (so any segment can have its own default and catch-all redirects).

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `routes` | `RouteConfig[]` | Yes | Array of route definitions. |
| `defaultRedirect` | `string` | No | Redirect path for empty route (`path: ''`). Omit or use **`''`** to skip adding a default redirect. |
| `catchAllRedirect` | `string` | No | Redirect path for unknown routes (`path: '**'`). Omit or use **`''`** to skip adding a catch-all. |

## RouteLoader API

| Member | Type | Description |
|--------|------|-------------|
| `loadRoutes(config)` | `(config: RouteConfigs) => Promise<void>` | Loads the given config object, updates signals, and resets the router. Use for in-memory config. |
| `loadRoutesFromUrl(configPath)` | `(configPath: string) => Promise<void>` | Fetches config from `configPath` (HTTP GET), then loads it. Sets `configPath` signal to the URL. |
| `routeConfigFile` | `Signal<RouteConfigs \| null>` | Readonly signal: currently loaded config, or `null` if not yet loaded. |
| `configPath` | `Signal<string>` | Readonly signal: URL from which the config was loaded (set only by `loadRoutesFromUrl`; empty after `loadRoutes`). |
| `routeConfig` | `Signal<RouteConfig[]>` | Computed signal: `routeConfigFile()?.routes ?? []`. |

## Config file example

Example JSON served at e.g. `/assets/routes.json`:

```json
{
  "routes": [
    {
      "path": "dashboard",
      "component": "DashboardComponent",
      "title": "Dashboard",
      "canActivate": ["auth"],
      "data": { "breadcrumb": "Dashboard" }
    },
    {
      "path": "login",
      "component": "LoginComponent",
      "canActivate": ["public"]
    },
    {
      "path": "settings",
      "component": "SettingsShell",
      "canActivate": ["auth"],
      "children": {
        "routes": [
          {
            "path": "profile",
            "component": "ProfileComponent",
            "title": "Profile"
          }
        ],
        "defaultRedirect": "profile",
        "catchAllRedirect": "profile"
      }
    }
  ],
  "defaultRedirect": "dashboard",
  "catchAllRedirect": "dashboard"
}
```

## Usage

1. **Register components and guards** (before loading routes):

```typescript
import { ComponentRegistry, GuardRegistry } from 'ngx-blocks-studio';

const compReg = ComponentRegistry.getInstance();
const guardReg = GuardRegistry.getInstance();

compReg.register('DashboardComponent', () => import('./dashboard').then(m => m.DashboardComponent));
compReg.register('LoginComponent', LoginComponent);
guardReg.register('auth', authGuard);
guardReg.register('public', publicGuard);
```

2. **Load routes** – from a config object or from a URL:

```typescript
import { RouteLoader } from 'ngx-blocks-studio';

// From a config object (e.g. in-memory or from your own fetch)
await this.routeLoader.loadRoutes(myRouteConfigs);

// From a URL (HTTP GET)
await this.routeLoader.loadRoutesFromUrl('/assets/routes.json');
```

3. **Read config reactively** (optional):

```typescript
// In a component or service
routeLoader = inject(RouteLoader);

config = this.routeLoader.routeConfigFile();  // current config or null
routes = this.routeLoader.routeConfig();     // array of RouteConfig
url = this.routeLoader.configPath();         // URL (set by loadRoutesFromUrl), or ''
```

## Errors

- **Missing component key**: If a route’s `component` is not registered in ComponentRegistry, `loadComponent` throws when that route is first loaded:  
  `Component "<key>" is not registered. Register it with ComponentRegistry before loading routes.`
- **Unknown guard**: If a guard key in `canActivate` (or other guard arrays) is not in GuardRegistry, a warning is logged and that guard is omitted from the route.

## Dependencies

- **Router** – Angular router (injected).
- **HttpClient** – Used to fetch the config file (injected).
- **ComponentRegistry** – Resolves component types by the `component` key on each route.
- **GuardRegistry** – Resolves guards by the keys in `canActivate`, `canDeactivate`, `canLoad`, `canMatch`, and `canActivateChild`.

[← Documentation index](../README.md) · [Registry (components, guards, services)](registry.md)
