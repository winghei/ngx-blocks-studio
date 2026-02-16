/**
 * Global registry of block id → definition. Register block configs at app init
 * so they can be used as templates anywhere (e.g. nested blocks that reference
 * { id: 'AppNav' } resolve without passing blockDefinitions down).
 * Per-call blockDefinitions (e.g. from route data) override global entries.
 */
export class BlockDefinitionsRegistry {
  private static instance: BlockDefinitionsRegistry;
  private readonly definitions = new Map<string, Record<string, unknown>>();

  private constructor() {}

  static getInstance(): BlockDefinitionsRegistry {
    if (!BlockDefinitionsRegistry.instance) {
      BlockDefinitionsRegistry.instance = new BlockDefinitionsRegistry();
    }
    return BlockDefinitionsRegistry.instance;
  }

  /** Register a block template by id. Can be called before the block is needed. */
  register(id: string, definition: Record<string, unknown>): void {
    this.definitions.set(id, definition);
  }

  /** Get one definition by id. */
  get(id: string): Record<string, unknown> | undefined {
    return this.definitions.get(id);
  }

  /** Get all registered definitions (id → definition). Used to merge with per-call definitions. */
  getAll(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    this.definitions.forEach((def, id) => {
      out[id] = def;
    });
    return out;
  }

  unregister(id: string): boolean {
    return this.definitions.delete(id);
  }
}
