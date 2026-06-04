# ngx-blocks-studio

Angular library for **schema-driven UI** and **config-driven routing**: register building blocks by name, describe screens as data, and wire state with **reference paths** (`{{ read-only }}`, `[( two-way )]`, cross-block `BlockId:...`).

**Start here:** **[Documentation overview](docs/overview.md)** — full feature list, learning path, demo and tests.

---

## What’s in `docs/`

| Topic | Doc | In short |
|--------|-----|----------|
| Big picture | [Overview](docs/overview.md) | Registries, JSON routes, block descriptions, refs, services/model, outputs |
| Glossary | [Concepts](docs/concepts.md) | Block vs route, `blockId` vs instance `id`, the four registry types, ref path shapes (including scoped `ScopeKey/BlockId:...`) |
| Patterns | [Block-directive use cases](docs/block-directive-use-cases.md) | Literals, `{{ }}` / `[( )]`, root vs self services, `blockId` reuse, output callable refs |
| APIs | [Registry](docs/core/registry.md) | `ComponentRegistry`, `DirectiveRegistry`, `GuardRegistry`, `ServiceRegistry`, metadata, `BlockDefinitionsRegistry` |
| `[block]` | [Block loader](docs/core/block-loader.md) | `BlockDirective`, `BlockLoaderService`, descriptions, refs, host directives, outputs |
| Routes | [Route loader](docs/core/router-loader.md) | `RouteLoader`, `RouteConfig` / `RouteConfigs`, `loadRoutes` / `loadRoutesFromUrl`, signals |

---

## Install

```bash
npm install ngx-blocks-studio
```

## Imports

Typical symbols (full surface: `projects/blocks-studio/src/public-api.ts`):

```typescript
import {
  RouteLoader,
  type RouteConfig,
  type RouteConfigs,
  ComponentRegistry,
  GuardRegistry,
  BlockDirective,
  BlockLoaderService,
  BlockDefinitionsRegistry,
} from 'ngx-blocks-studio';
```

---

## Examples (from the docs)

### 1. Register components and guards, load routes

Every **component** and **guard** key in your config must be registered before `loadRoutes` or `loadRoutesFromUrl`:

```typescript
import { inject } from '@angular/core';
import { ComponentRegistry, GuardRegistry, RouteLoader } from 'ngx-blocks-studio';

const components = ComponentRegistry.getInstance();
const guards = GuardRegistry.getInstance();

components.register('HomePage', HomeComponent);
guards.register('auth', authGuardFn);

const routeLoader = inject(RouteLoader);
await routeLoader.loadRoutes({
  routes: [{ path: 'home', component: 'HomePage', title: 'Home' }],
  defaultRedirect: 'home',
});
```

JSON routes can include `children`, `data`, `title`, and guard keys (`canActivate`, …). Example shape (see [Route loader](docs/core/router-loader.md)):

```json
{
  "routes": [
    {
      "path": "dashboard",
      "component": "DashboardComponent",
      "title": "Dashboard",
      "canActivate": ["auth"],
      "data": { "breadcrumb": "Dashboard" }
    }
  ],
  "defaultRedirect": "dashboard"
}
```

### 2. Render a block with `[block]`

Register the component key, then pass a **block description** (or a `{ blockId: '...' }` reference). Use a shared **`BlockRegistry`** for nested blocks and cross-block refs.

```typescript
components.register('MyPanel', MyPanelComponent);
```

```html
<div
  [block]
  [description]="{ component: 'MyPanel', id: 'Panel1', inputs: { title: 'Hello' } }"
  [blockRegistry]="registry"
></div>
```

### 3. Read-only and two-way refs

- **Read-only:** strings containing `{{ refPath }}` — e.g. `FormState.firstName` on the current block, or `PersonForm:FormState.lastName` for another block in the same registry.
- **Two-way:** the **entire** input value must be exactly `"[(refPath)]"` (no mixing with literals in the same string), e.g. `'[(PersonForm:FormState.firstName)]'`.

### 4. Reuse a definition with `blockId`

Look up a stored definition from `blockDefinitions` or **`BlockDefinitionsRegistry`**:

```typescript
// In route data or nested layout
{ blockId: 'PersonForm' }
// Optional instance id override + deep-merge overrides:
{ blockId: 'PersonForm', id: 'PersonFormEdit', blockDefinition: { inputs: { title: 'Edit' } } }
```

Model for the block is passed via **`[model]`** on the directive or the `load()` API — not via `inputs.model` for `blockInstance.model` (see [Block loader – Services and model](docs/core/block-loader.md#services-and-model)).

### 5. Services (root vs self)

```typescript
// Root-first: use DI instance if provided, else self-scoped fallback
services: [{ id: 'FormState' }]

// One instance per block (child injector)
services: [{ id: 'AuthState', scope: 'self' }]
```

### 6. Outputs as callable refs

Wire `outputs` to methods on services or signals, e.g. a string ref `"PersonForm:FormState.age.set"` or an object `{ ref: 'FormState.alert', params: ['Age: {{value}}'] }` with optional `then` / `onError` for async chaining ([Block loader – Outputs](docs/core/block-loader.md#outputs-callable-refs)).

---

## Try it and test

- **Demo:** `projects/demo` — `RouteLoader` in `app.config.ts`, sample data under `projects/demo/src/app/route-data/`. Run `ng serve demo` after building or linking the library.
- **Tests:** `npm run test:block-directives` — see `tests/block-directives/README.md`.

---

## Build the library

```bash
ng build blocks-studio
```

Output: `dist/blocks-studio`.
