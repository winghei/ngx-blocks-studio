/**
 * Global registry of block id → definition. Register block configs at app init
 * so they can be used as templates anywhere (e.g. nested blocks that reference
 * { id: 'AppNav' } resolve without passing blockDefinitions down).
 * Per-call blockDefinitions (e.g. from route data) override global entries.
 *
 * Values may be a plain definition object or a zero-arg loader
 * `() => Promise<Record<string, unknown>>` for lazy loading (same pattern as
 * ComponentRegistry / DirectiveRegistry).
 */
export type BlockDefinitionLoader = () => Promise<Record<string, unknown>>;
export type BlockDefinitionOrLoader = Record<string, unknown> | BlockDefinitionLoader;

/** True for zero-arg async loaders (not class constructors). */
export function isBlockDefinitionLoader(value: unknown): value is BlockDefinitionLoader {
  if (typeof value !== 'function') {
    return false;
  }
  const looksLikeClass =
    typeof (value as { prototype?: unknown }).prototype !== 'undefined' &&
    (value as { prototype?: { constructor?: unknown } }).prototype?.constructor === value;
  return (value as BlockDefinitionLoader).length === 0 && !looksLikeClass;
}

export class BlockDefinitionsRegistry {
  private static instance: BlockDefinitionsRegistry;
  private readonly definitions = new Map<string, BlockDefinitionOrLoader>();
  private readonly loadedDefinitions = new Map<string, Record<string, unknown>>();

  private constructor() {}

  static getInstance(): BlockDefinitionsRegistry {
    if (!BlockDefinitionsRegistry.instance) {
      BlockDefinitionsRegistry.instance = new BlockDefinitionsRegistry();
    }
    return BlockDefinitionsRegistry.instance;
  }

  /** Register a block template by id (plain object or async loader). */
  register(id: string, definition: BlockDefinitionOrLoader): void {
    this.definitions.set(id, definition);
    if (!isBlockDefinitionLoader(definition)) {
      this.loadedDefinitions.set(id, definition as Record<string, unknown>);
    } else {
      this.loadedDefinitions.delete(id);
    }
  }

  /** Resolve definition by id; runs loader once and caches the result. */
  async get(id: string): Promise<Record<string, unknown> | undefined> {
    if (this.loadedDefinitions.has(id)) {
      return this.loadedDefinitions.get(id);
    }

    const defOrLoader = this.definitions.get(id);
    if (!defOrLoader) {
      return undefined;
    }

    if (isBlockDefinitionLoader(defOrLoader)) {
      try {
        const loaded = await defOrLoader();
        this.loadedDefinitions.set(id, loaded);
        return loaded;
      } catch (error) {
        console.error(`Failed to lazy load block definition "${id}":`, error);
        return undefined;
      }
    }

    const def = defOrLoader as Record<string, unknown>;
    this.loadedDefinitions.set(id, def);
    return def;
  }

  /** Sync access when the definition is already a plain object or was loaded. */
  getSync(id: string): Record<string, unknown> | undefined {
    if (this.loadedDefinitions.has(id)) {
      return this.loadedDefinitions.get(id);
    }

    const defOrLoader = this.definitions.get(id);
    if (!defOrLoader || isBlockDefinitionLoader(defOrLoader)) {
      return undefined;
    }

    const def = defOrLoader as Record<string, unknown>;
    this.loadedDefinitions.set(id, def);
    return def;
  }

  has(id: string): boolean {
    return this.definitions.has(id);
  }

  /** Plain definitions plus any lazy definitions that have been loaded at least once. */
  getAll(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [id, def] of this.definitions) {
      if (isBlockDefinitionLoader(def)) {
        const loaded = this.loadedDefinitions.get(id);
        if (loaded != null) {
          out[id] = loaded;
        }
      } else {
        out[id] = def as Record<string, unknown>;
      }
    }
    return out;
  }

  unregister(id: string): boolean {
    this.loadedDefinitions.delete(id);
    return this.definitions.delete(id);
  }

  clear(): void {
    this.definitions.clear();
    this.loadedDefinitions.clear();
  }
}
