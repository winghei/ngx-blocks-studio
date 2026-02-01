import { Type } from '@angular/core';
import {
  RegistryMetadataStore,
  RegistryMetadataRecord,
} from './registry-metadata';

type ComponentLoader = () => Promise<Type<any>>;
type ComponentOrLoader = Type<any> | ComponentLoader;

export class ComponentRegistry {
  private static instance: ComponentRegistry;
  private components = new Map<string, ComponentOrLoader>();
  private loadedComponents = new Map<string, Type<any>>();
  private readonly metadataStore = RegistryMetadataStore.getInstance();

  private constructor() {}

  static getInstance(): ComponentRegistry {
    if (!ComponentRegistry.instance) {
      ComponentRegistry.instance = new ComponentRegistry();
    }
    return ComponentRegistry.instance;
  }

  register(
    name: string,
    component: Type<any> | ComponentLoader,
    metadata?: RegistryMetadataRecord
  ): void {
    if (this.components.has(name)) {
      console.warn(`Component ${name} is already registered. Overwriting...`);
    }

    this.components.set(name, component);
    // If it's already a Type, cache it
    if (typeof component !== 'function' || component.prototype) {
      this.loadedComponents.set(name, component as Type<any>);
    }
    if (metadata != null && Object.keys(metadata).length > 0) {
      this.metadataStore.set(name, 'component', metadata);
    }
  }

  async get(name: string): Promise<Type<any> | undefined> {
    // Check if already loaded
    if (this.loadedComponents.has(name)) {
      return this.loadedComponents.get(name);
    }

    const componentOrLoader = this.components.get(name);
    if (!componentOrLoader) {
      return undefined;
    }

    // Check if it's a loader function (not a Type)
    // Type functions have a prototype, loader functions don't
    const isLoader =
      typeof componentOrLoader === 'function' && !(componentOrLoader as any).prototype?.constructor;

    if (isLoader) {
      try {
        const loader = componentOrLoader as ComponentLoader;
        const component = await loader();
        this.loadedComponents.set(name, component);
        return component;
      } catch (error) {
        console.error(`Failed to lazy load component "${name}":`, error);
        return undefined;
      }
    }

    // It's already a Type
    const component = componentOrLoader as Type<any>;
    this.loadedComponents.set(name, component);
    return component;
  }

  getSync(name: string): Type<any> | undefined {
    // Check if already loaded
    if (this.loadedComponents.has(name)) {
      return this.loadedComponents.get(name);
    }

    const componentOrLoader = this.components.get(name);
    if (!componentOrLoader) {
      return undefined;
    }

    // Check if it's a loader function (not a Type)
    const isLoader =
      typeof componentOrLoader === 'function' && !(componentOrLoader as any).prototype?.constructor;

    // If it's a loader, we can't get it synchronously
    if (isLoader) {
      return undefined;
    }

    // It's already a Type
    const component = componentOrLoader as Type<any>;
    this.loadedComponents.set(name, component);
    return component;
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  getAll(): Map<string, Type<any>> {
    return new Map(this.loadedComponents);
  }

  unregister(name: string): boolean {
    this.metadataStore.remove(name);
    this.loadedComponents.delete(name);
    return this.components.delete(name);
  }

  clear(): void {
    for (const name of this.components.keys()) {
      this.metadataStore.remove(name);
    }
    this.components.clear();
    this.loadedComponents.clear();
  }

  getMetadata(key: string): RegistryMetadataRecord | undefined {
    return this.metadataStore.getMetadata(key);
  }

  getAllWithMetadata(): Map<string, { component: Type<any>; metadata?: RegistryMetadataRecord }> {
    const result = new Map<string, { component: Type<any>; metadata?: RegistryMetadataRecord }>();
    for (const [name, component] of this.loadedComponents) {
      result.set(name, {
        component,
        metadata: this.metadataStore.getMetadata(name),
      });
    }
    return result;
  }
}
