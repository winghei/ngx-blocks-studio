/**
 * Registry entry type: component, service, or guard.
 */
export type RegistryEntryType = 'component' | 'service' | 'guard';

/**
 * Metadata value stored per registry key.
 */
export type RegistryMetadataRecord = Record<string, unknown>;

export interface AllRegistryMetadata {
  components: Map<string, RegistryMetadataRecord>;
  services: Map<string, RegistryMetadataRecord>;
  guards: Map<string, RegistryMetadataRecord>;
}

/**
 * Single source of truth for metadata across component, service, and guard registries.
 * All registries delegate to this store so metadata can be queried uniformly
 * and all metadata can be retrieved in one call.
 */
export class RegistryMetadataStore {
  private static instance: RegistryMetadataStore;
  private entries = new Map<string, { type: RegistryEntryType; data: RegistryMetadataRecord }>();

  private constructor() {}

  static getInstance(): RegistryMetadataStore {
    if (!RegistryMetadataStore.instance) {
      RegistryMetadataStore.instance = new RegistryMetadataStore();
    }
    return RegistryMetadataStore.instance;
  }

  /**
   * Set metadata for a registry key (component, service, or guard).
   */
  set(key: string, type: RegistryEntryType, data: RegistryMetadataRecord): void {
    this.entries.set(key, { type, data });
  }

  /**
   * Get metadata for a key. Returns undefined if the key is not registered.
   */
  get(key: string): RegistryMetadataRecord | undefined {
    return this.entries.get(key)?.data;
  }

  /**
   * Alias for get(); allows registries to expose getMetadata(key).
   */
  getMetadata(key: string): RegistryMetadataRecord | undefined {
    return this.get(key);
  }

  /**
   * Get all metadata for a given type (components or services).
   */
  getByType(type: RegistryEntryType): Map<string, RegistryMetadataRecord> {
    const result = new Map<string, RegistryMetadataRecord>();
    for (const [key, entry] of this.entries) {
      if (entry.type === type) {
        result.set(key, entry.data);
      }
    }
    return result;
  }

  /**
   * Get all metadata for component, service, and guard registries in one call.
   */
  getAllMetadata(): AllRegistryMetadata {
    return {
      components: this.getByType('component'),
      services: this.getByType('service'),
      guards: this.getByType('guard'),
    };
  }

  /**
   * Remove metadata for a key (e.g. when unregistering).
   */
  remove(key: string): boolean {
    return this.entries.delete(key);
  }

  /**
   * Check if metadata exists for a key.
   */
  has(key: string): boolean {
    return this.entries.has(key);
  }

  /**
   * Clear all metadata (e.g. when clearing registries).
   */
  clear(): void {
    this.entries.clear();
  }
}
