import { Type, Injector, inject } from '@angular/core';
import {
  RegistryMetadataStore,
  RegistryMetadataRecord,
} from './registry-metadata';

type ServiceLoader = () => Promise<Type<any>>;
type ServiceOrLoader = Type<any> | ServiceLoader;

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services = new Map<string, ServiceOrLoader>();
  private loadedServices = new Map<string, Type<any>>();
  private injector: Injector | null = null;
  private readonly metadataStore = RegistryMetadataStore.getInstance();

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Set the injector to use for service resolution
   */
  setInjector(injector: Injector): void {
    this.injector = injector;
  }

  /**
   * Register a service by name (supports lazy loading)
   */
  register(
    name: string,
    service: Type<any> | ServiceLoader,
    metadata?: RegistryMetadataRecord
  ): void {
    if (this.services.has(name)) {
      console.warn(`Service ${name} is already registered. Overwriting...`);
    }
    this.services.set(name, service);
    // If it's already a Type, cache it
    if (typeof service !== 'function' || (service as any).prototype) {
      this.loadedServices.set(name, service as Type<any>);
    }
    if (metadata != null && Object.keys(metadata).length > 0) {
      this.metadataStore.set(name, 'service', metadata);
    }
  }

  /**
   * Get a service instance by name (supports lazy loading)
   * Requires injector to be set first
   */
  async get(name: string): Promise<any> {
    // Check if already loaded
    if (this.loadedServices.has(name)) {
      const serviceType = this.loadedServices.get(name)!;
      return this.injectService(serviceType);
    }

    const serviceOrLoader = this.services.get(name);
    if (!serviceOrLoader) {
      console.error(`Service "${name}" not found in registry`);
      return undefined;
    }

    // Check if it's a loader function (not a Type)
    const isLoader = typeof serviceOrLoader === 'function' && 
                     !(serviceOrLoader as any).prototype?.constructor;

    if (isLoader) {
      try {
        const loader = serviceOrLoader as ServiceLoader;
        const serviceType = await loader();
        this.loadedServices.set(name, serviceType);
        return this.injectService(serviceType);
      } catch (error) {
        console.error(`Failed to lazy load service "${name}":`, error);
        return undefined;
      }
    }

    // It's already a Type
    const serviceType = serviceOrLoader as Type<any>;
    this.loadedServices.set(name, serviceType);
    return this.injectService(serviceType);
  }

  /**
   * Get a service instance synchronously (only works for already loaded services)
   */
  getSync(name: string): any {
    // Check if already loaded
    if (this.loadedServices.has(name)) {
      const serviceType = this.loadedServices.get(name)!;
      return this.injectService(serviceType);
    }

    const serviceOrLoader = this.services.get(name);
    if (!serviceOrLoader) {
      console.error(`Service "${name}" not found in registry`);
      return undefined;
    }

    // Check if it's a loader function
    const isLoader = typeof serviceOrLoader === 'function' && 
                     !(serviceOrLoader as any).prototype?.constructor;

    // If it's a loader, we can't get it synchronously
    if (isLoader) {
      console.warn(`Service "${name}" is lazy loaded and cannot be retrieved synchronously. Use get() instead.`);
      return undefined;
    }

    // It's already a Type
    const serviceType = serviceOrLoader as Type<any>;
    this.loadedServices.set(name, serviceType);
    return this.injectService(serviceType);
  }

  /**
   * Inject a service type using the injector
   */
  private injectService(serviceType: Type<any>): any {
    if (!this.injector) {
      // Try to use inject() if no injector is set
      try {
        return inject(serviceType);
      } catch (error) {
        console.error(`Cannot inject service: No injector set and inject() failed`, error);
        return undefined;
      }
    }

    try {
      return this.injector.get(serviceType);
    } catch (error) {
      console.error(`Failed to get service from injector:`, error);
      return undefined;
    }
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   */
  getAllNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get metadata for a registered service by key.
   */
  getMetadata(key: string): RegistryMetadataRecord | undefined {
    return this.metadataStore.getMetadata(key);
  }

  /**
   * Unregister a service
   */
  unregister(name: string): boolean {
    this.metadataStore.remove(name);
    this.loadedServices.delete(name);
    return this.services.delete(name);
  }

  /**
   * Clear all registered services
   */
  clear(): void {
    for (const name of this.services.keys()) {
      this.metadataStore.remove(name);
    }
    this.services.clear();
    this.loadedServices.clear();
  }
}

