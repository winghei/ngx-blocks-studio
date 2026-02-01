# Registry

The registry module provides a unified system for registering and resolving Angular **components**, **services**, and **guards** by name, with optional **metadata** and **lazy loading**. Metadata is stored in a single shared store so it can be queried per registry or for all registries at once.

**Source:** `projects/blocks-studio/src/lib/core/registry/`

## Overview

- **ComponentRegistry** – Register Angular component types (or loaders) by name; resolve by name with optional lazy loading.
- **GuardRegistry** – Register route guards (or loaders) by name; resolve by name with optional lazy loading.
- **ServiceRegistry** – Register Angular service types (or loaders) by name; resolve **instances** via the Angular injector, with optional lazy loading.
- **RegistryMetadataStore** – Single source of truth for metadata for all registries; supports `getMetadata(key)` per registry and `getAllMetadata()` for components, services, and guards together.

All four are singletons. Component, guard, and service registries delegate metadata to `RegistryMetadataStore`, so metadata is consistent and can be aggregated across registries.

## Source layout

```
projects/blocks-studio/src/lib/core/registry/
├── index.ts                  # Public exports
├── component.registry.ts     # Component registry (types by name)
├── guard.registry.ts         # Guard registry (guards by name)
├── service.registry.ts       # Service registry (instances via injector)
└── registry-metadata.ts      # Unified metadata store
```

## Unified metadata

Metadata is stored in **RegistryMetadataStore**, shared by all registries. When you register a component, guard, or service with metadata, it is stored there and tagged by type (`'component'`, `'guard'`, or `'service'`).

### Types

| Type | Description |
|------|-------------|
| `RegistryEntryType` | `'component' \| 'service' \| 'guard'` |
| `RegistryMetadataRecord` | `Record<string, unknown>` – free-form metadata per key |
| `AllRegistryMetadata` | `{ components: Map<...>; services: Map<...>; guards: Map<...> }` |

### RegistryMetadataStore API

| Method | Description |
|--------|-------------|
| `getInstance()` | Get the singleton instance. |
| `set(key, type, data)` | Set metadata for a key (used by registries on register). |
| `get(key)` | Get metadata for a key. |
| `getMetadata(key)` | Alias for `get(key)`. |
| `getByType(type)` | All metadata for `'component'`, `'service'`, or `'guard'`. |
| `getAllMetadata()` | All metadata for all registries: `{ components, services, guards }`. |
| `has(key)` | Whether metadata exists for the key. |
| `remove(key)` | Remove metadata for a key (used by registries on unregister). |
| `clear()` | Remove all metadata. |

### Getting all metadata for all registries

Use the metadata store directly:

```typescript
import { RegistryMetadataStore } from 'ngx-blocks-studio'; // or your path to core

const store = RegistryMetadataStore.getInstance();
const all = store.getAllMetadata();

// all.components: Map<string, RegistryMetadataRecord>
// all.services: Map<string, RegistryMetadataRecord>
// all.guards: Map<string, RegistryMetadataRecord>
```

---

## ComponentRegistry

Registers Angular **component types** (or loader functions) by name. Use it when you need to resolve a component type by string key (e.g. for dynamic component loading).

### API

| Method | Description |
|--------|-------------|
| `getInstance()` | Get the singleton instance. |
| `register(name, component, metadata?)` | Register a component type or a `() => Promise<Type<any>>` loader. Optional metadata is stored in the shared metadata store. |
| `get(name)` | Resolve component type by name (async; runs loader if needed). Returns `Promise<Type<any> \| undefined>`. |
| `getSync(name)` | Resolve component type synchronously. Returns `undefined` if the entry is a lazy loader. |
| `has(name)` | Whether a component is registered for that name. |
| `getAll()` | Copy of the map of loaded component types (`Map<string, Type<any>>`). |
| `getMetadata(key)` | Get metadata for the component key from the shared store. |
| `getAllWithMetadata()` | Map of name → `{ component, metadata? }` for all loaded components. |
| `unregister(name)` | Remove the component and its metadata. |
| `clear()` | Remove all components and their metadata. |

### Lazy loading

You can register a **loader** instead of a type:

```typescript
componentRegistry.register(
  'heavy-chart',
  () => import('./heavy-chart.component').then(m => m.HeavyChartComponent)
);
```

The first time `get('heavy-chart')` is called, the loader runs and the result is cached.

### Example

```typescript
import { ComponentRegistry } from 'ngx-blocks-studio';

const registry = ComponentRegistry.getInstance();

// Register with metadata
registry.register('my-block', MyBlockComponent, { category: 'layout', version: 1 });

// Resolve
const type = await registry.get('my-block');
const meta = registry.getMetadata('my-block');
```

---

## ServiceRegistry

Registers Angular **service types** (or loader functions) by name and resolves **instances** via the Angular injector. Use it when you need to get a service instance by string key.

### Injector

Service instances are created with Angular’s `Injector`. You must call **`setInjector(injector)`** before using `get()` or `getSync()`. If no injector is set, `getSync()` may still try `inject(serviceType)` when run in an injection context.

### API

| Method | Description |
|--------|-------------|
| `getInstance()` | Get the singleton instance. |
| `setInjector(injector)` | Set the injector used to resolve service instances. **Required** for `get()` / `getSync()` unless `inject()` is used as fallback. |
| `register(name, service, metadata?)` | Register a service type or a `() => Promise<Type<any>>` loader. Optional metadata is stored in the shared metadata store. |
| `get(name)` | Resolve **instance** by name (async; runs loader if needed). Returns `Promise<any>`. |
| `getSync(name)` | Resolve **instance** synchronously. Returns `undefined` if the entry is a lazy loader. |
| `has(name)` | Whether a service is registered for that name. |
| `getAllNames()` | All registered service names. |
| `getMetadata(key)` | Get metadata for the service key from the shared store. |
| `unregister(name)` | Remove the service and its metadata. |
| `clear()` | Remove all services and their metadata. |

### Lazy loading

You can register a loader:

```typescript
serviceRegistry.register(
  'analytics',
  () => import('./analytics.service').then(m => m.AnalyticsService)
);
```

The first time `get('analytics')` is called, the loader runs and the resolved type is used to get an instance from the injector.

### Example

```typescript
import { Injector } from '@angular/core';
import { ServiceRegistry } from 'ngx-blocks-studio';

const registry = ServiceRegistry.getInstance();
registry.setInjector(injector);

registry.register('api', ApiService, { scope: 'global' });
registry.register('logger', LoggerService, { level: 'debug' });

const api = await registry.get('api');
const meta = registry.getMetadata('api');
```

---

## GuardRegistry

Registers **route guards** (functional or class-based) or loader functions by name. Use it when you need to resolve a guard by string key (e.g. for `RouteLoader` from route config `guards: ['auth']`).

### API

| Method | Description |
|--------|-------------|
| `getInstance()` | Get the singleton instance. |
| `register(name, guard, metadata?)` | Register a guard type/function or a `() => Promise<GuardOrType>` loader. Optional metadata is stored in the shared metadata store. |
| `get(name)` | Resolve guard by name (async; runs loader if needed). Returns `Promise<GuardOrType \| undefined>`. |
| `getSync(name)` | Resolve guard synchronously. Returns `undefined` if the entry is a lazy loader not yet loaded. |
| `has(name)` | Whether a guard is registered for that name. |
| `getMetadata(key)` | Get metadata for the guard key from the shared store. |
| `getAllWithMetadata()` | Map of name → `{ guard, metadata? }` for all loaded guards. |
| `unregister(name)` | Remove the guard and its metadata. |
| `clear()` | Remove all guards and their metadata. |

### Lazy loading

You can register a loader instead of a guard:

```typescript
guardRegistry.register(
  'featureGuard',
  () => import('./feature.guard').then(m => m.featureGuard)
);
```

The first time `get('featureGuard')` is called, the loader runs and the result is cached.

### Example

```typescript
import { GuardRegistry } from 'ngx-blocks-studio';

const registry = GuardRegistry.getInstance();

// Register with metadata
registry.register('auth', authGuardFn, { scope: 'protected', redirectTo: '/login' });
registry.register('public', publicGuardFn, { scope: 'anonymous' });

// Resolve
const guard = await registry.get('auth');
const meta = registry.getMetadata('auth');
```

---

## Usage summary

### Per-registry metadata by key

All registries expose `getMetadata(key)`:

```typescript
const compMeta = ComponentRegistry.getInstance().getMetadata('my-block');
const guardMeta = GuardRegistry.getInstance().getMetadata('auth');
const svcMeta = ServiceRegistry.getInstance().getMetadata('api');
```

### All metadata for all registries

Use the shared metadata store:

```typescript
import {
  ComponentRegistry,
  GuardRegistry,
  ServiceRegistry,
  RegistryMetadataStore,
} from 'ngx-blocks-studio';

// Register with metadata
const compReg = ComponentRegistry.getInstance();
const guardReg = GuardRegistry.getInstance();
const svcReg = ServiceRegistry.getInstance();

compReg.register('my-block', MyBlockComponent, { category: 'layout', version: 1 });
guardReg.register('auth', authGuard, { scope: 'protected' });
svcReg.register('api', ApiService, { scope: 'feature' });

// Per-registry by key
compReg.getMetadata('my-block');   // { category: 'layout', version: 1 }
guardReg.getMetadata('auth');      // { scope: 'protected' }
svcReg.getMetadata('api');         // { scope: 'feature' }

// All metadata in one call
const all = RegistryMetadataStore.getInstance().getAllMetadata();
// all.components, all.guards, all.services: Map<string, RegistryMetadataRecord>
```

---

## Public exports

The registry module (from the library’s core) exports:

- **ComponentRegistry**
- **GuardRegistry**
- **GuardOrType**, **GuardLoader**, **GuardOrLoader**
- **ServiceRegistry**
- **RegistryMetadataStore**
- **RegistryEntryType**
- **RegistryMetadataRecord**
- **AllRegistryMetadata**

[← Documentation index](../README.md)
