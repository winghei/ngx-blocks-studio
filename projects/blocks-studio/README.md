# ngx-blocks-studio

Angular library for **config-driven routing** and **block-based UIs**. Define routes and component trees in data; the library resolves components and guards by name and wires inputs, outputs, and cross-block references.

Extended documentation (overview, concepts, registry / block loader / route loader guides, and block-directive patterns) lives in the **`docs/`** folder of the **source repository**—it is not shipped inside the npm package, so browse or clone the repo for full prose and learning paths.

---

## Install

```bash
npm install ngx-blocks-studio
```

**Peer dependencies:** `@angular/common`, `@angular/core`, and `@angular/router` (see `package.json` for supported versions), plus `rxjs`.

---

## Imports

Typical entry points:

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

Import additional symbols from the same package as needed for your app.

---

## Bootstrap (`main.ts` and `app.config.ts`)

`RouteLoader` is **`providedIn: 'root'`**—no extra `providers` entry for it. Start the app with **`bootstrapApplication`**, use an **empty** `provideRouter([])` (the loader replaces the router config), and load routes once at startup—typically in **`provideAppInitializer`** so registration runs before navigation.

**`main.ts`**

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
```

**`app.config.ts`**

```typescript
import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ComponentRegistry, RouteLoader } from 'ngx-blocks-studio';
import { HomeComponent } from './home.component';

function registerBlocks(): void {
  ComponentRegistry.getInstance().register('HomePage', HomeComponent);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(), // use when calling RouteLoader.loadRoutesFromUrl(...)
    provideRouter([]),
    provideAppInitializer(() => {
      const routeLoader = inject(RouteLoader);
      registerBlocks();
      return routeLoader.loadRoutes({
        routes: [{ path: 'home', component: 'HomePage', title: 'Home' }],
        defaultRedirect: 'home',
      });
    }),
  ],
};
```

Register every **component** and **guard** key used in the config inside `registerBlocks()` (or equivalent) **before** `loadRoutes` resolves. Omit **`provideHttpClient`** if you only use **`loadRoutes`** with in-memory config and never **`loadRoutesFromUrl`**.

---

## Example: register keys and load routes

Register every **component** and **guard** key used in your route config, then call `loadRoutes` or `loadRoutesFromUrl`:

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

JSON route files can include `children`, `data`, `title`, and guard arrays (`canActivate`, etc.). After loading, `RouteLoader` exposes the active config via **signals** (`routeConfigFile`, `routeConfig`, …).

---

## Example: render a block with `[block]`

Register the component key, then pass a **block description** and a shared **`BlockRegistry`** so nested blocks and cross-block refs resolve.

```typescript
ComponentRegistry.getInstance().register('MyPanel', MyPanelComponent);
```

```html
<div
  [block]
  [description]="{
    component: 'MyPanel',
    id: 'Panel1',
    inputs: { title: 'Hello' }
  }"
  [blockRegistry]="registry"
></div>
```

---

## Example: refs, reuse, services, outputs

- **Read-only:** input strings may contain `{{ refPath }}` (e.g. `FormState.name` on the current block, or `OtherBlockId:FormState.name` for another block in the same registry).
- **Two-way:** the entire input value must be exactly `"[(refPath)]"` (no mixing with literals in the same string).
- **Reuse:** `{ blockId: 'RegisteredBlock' }` looks up a definition (local map or `BlockDefinitionsRegistry`); optional `blockDefinition` deep-merges overrides. Pass the block **model** via `[model]` or `BlockLoaderService.load(…)`—not via `inputs.model` for `blockInstance.model`.
- **Services:** `services: [{ id: 'State' }]` is root-first with self fallback; `services: [{ id: 'State', scope: 'self' }]` creates a per-block instance.
- **Outputs:** map output names to callable ref strings (e.g. `"BlockId:Service.signal.set"`) or objects with `ref`, optional `params`, `then`, and `onError` for async chaining.

---

## What the library provides

- **Registries** — Register components, guards, directives, and services by string key (optional lazy loaders and metadata). Used when resolving route config and block descriptions.
- **Block loader** — `BlockDirective` / `BlockLoaderService`: render from descriptions or `blockId` references, wire refs and host directives, validate keys against the component and host directives.
- **Route loader** — `RouteLoader`: build Angular `Routes` from JSON or in-memory `RouteConfigs`, reset the router, expose config as signals.

---

## API surface (where to look in docs)

When you have the repo: **Registry** (registries and metadata), **Block loader** (`BlockDirective`, `BlockLoaderService`, refs, outputs), **Route loader** (`RouteLoader`, `RouteConfig`, JSON loading). The source tree under `projects/blocks-studio/src/lib` matches the public exports.
