# ngx-blocks-studio

Create different application using Schema-Driven UI approach.

## Install

```bash
npm install ngx-blocks-studio
```

## Import

```typescript
import {
  RouterLoaderService,
  ComponentRegistryService,
  BlocksStudioComponent,
  type RouteConfig,
} from 'ngx-blocks-studio';
```

## Core services

### RouterLoaderService

Load and register routes dynamically (e.g. for schema-driven routing).

```typescript
constructor(private routerLoader: RouterLoaderService) {}

ngOnInit() {
  this.routerLoader.loadRoutes([
    { path: 'custom', loadComponent: () => import('./custom.component').then(m => m.CustomComponent) },
  ]);
  // Apply to Router: this.router.resetConfig([...this.router.config, ...this.routerLoader.routes()]);
}
```

### ComponentRegistryService

Register and resolve components by name for dynamic/schema-driven UI.

```typescript
constructor(private registry: ComponentRegistryService) {}

ngOnInit() {
  this.registry.register('my-block', MyBlockComponent);
  const component = this.registry.get('my-block');
}
```

## Build

```bash
ng build blocks-studio
```

Output is written to `dist/blocks-studio`.
