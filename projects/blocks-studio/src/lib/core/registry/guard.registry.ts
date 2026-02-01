import { Type } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import {
  RegistryMetadataStore,
  RegistryMetadataRecord,
} from './registry-metadata';

/**
 * Guard type: functional guard or class-based guard type.
 * Registered by name; resolved by RouteLoader from route config guards array.
 */
export type GuardOrType = CanActivateFn | Type<unknown>;

/** Loader for lazy-loaded guards. Must be a function with no parameters that returns Promise<GuardOrType>. */
export type GuardLoader = () => Promise<GuardOrType>;

export type GuardOrLoader = GuardOrType | GuardLoader;

export class GuardRegistry {
  private static instance: GuardRegistry;
  private guards = new Map<string, GuardOrLoader>();
  private loadedGuards = new Map<string, GuardOrType>();
  private readonly metadataStore = RegistryMetadataStore.getInstance();

  private constructor() {}

  static getInstance(): GuardRegistry {
    if (!GuardRegistry.instance) {
      GuardRegistry.instance = new GuardRegistry();
    }
    return GuardRegistry.instance;
  }

  register(name: string, guard: GuardOrLoader, metadata?: RegistryMetadataRecord): void {
    if (this.guards.has(name)) {
      console.warn(`Guard "${name}" is already registered. Overwriting...`);
    }
    this.guards.set(name, guard);
    if (!this.isLoader(guard)) {
      this.loadedGuards.set(name, guard as GuardOrType);
    } else {
      this.loadedGuards.delete(name);
    }
    if (metadata != null && Object.keys(metadata).length > 0) {
      this.metadataStore.set(name, 'guard', metadata);
    }
  }

  /**
   * Resolve guard by name (async; runs loader if needed).
   */
  async get(name: string): Promise<GuardOrType | undefined> {
    if (this.loadedGuards.has(name)) {
      return this.loadedGuards.get(name);
    }

    const guardOrLoader = this.guards.get(name);
    if (!guardOrLoader) {
      return undefined;
    }

    if (this.isLoader(guardOrLoader)) {
      try {
        const loader = guardOrLoader as GuardLoader;
        const guard = await loader();
        this.loadedGuards.set(name, guard);
        return guard;
      } catch (error) {
        console.error(`Failed to lazy load guard "${name}":`, error);
        return undefined;
      }
    }

    const guard = guardOrLoader as GuardOrType;
    this.loadedGuards.set(name, guard);
    return guard;
  }

  /**
   * Resolve guard synchronously. Returns undefined if the entry is a lazy loader not yet loaded.
   */
  getSync(name: string): GuardOrType | undefined {
    if (this.loadedGuards.has(name)) {
      return this.loadedGuards.get(name);
    }

    const guardOrLoader = this.guards.get(name);
    if (!guardOrLoader || this.isLoader(guardOrLoader)) {
      return undefined;
    }

    const guard = guardOrLoader as GuardOrType;
    this.loadedGuards.set(name, guard);
    return guard;
  }

  has(name: string): boolean {
    return this.guards.has(name);
  }

  getMetadata(key: string): RegistryMetadataRecord | undefined {
    return this.metadataStore.getMetadata(key);
  }

  getAllWithMetadata(): Map<string, { guard: GuardOrType; metadata?: RegistryMetadataRecord }> {
    const result = new Map<string, { guard: GuardOrType; metadata?: RegistryMetadataRecord }>();
    for (const [name, guard] of this.loadedGuards) {
      result.set(name, {
        guard,
        metadata: this.metadataStore.getMetadata(name),
      });
    }
    return result;
  }

  unregister(name: string): boolean {
    this.metadataStore.remove(name);
    this.loadedGuards.delete(name);
    return this.guards.delete(name);
  }

  clear(): void {
    for (const name of this.guards.keys()) {
      this.metadataStore.remove(name);
    }
    this.guards.clear();
    this.loadedGuards.clear();
  }

  private isLoader(value: GuardOrLoader): value is GuardLoader {
    return (
      typeof value === 'function' &&
      (value as GuardLoader).length === 0
    );
  }
}
