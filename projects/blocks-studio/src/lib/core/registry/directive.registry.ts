import { Type } from '@angular/core';
import {
  RegistryMetadataStore,
  RegistryMetadataRecord,
} from './registry-metadata';

type DirectiveLoader = () => Promise<Type<unknown>>;
type DirectiveOrLoader = Type<unknown> | DirectiveLoader;

export class DirectiveRegistry {
  private static instance: DirectiveRegistry;
  private directives = new Map<string, DirectiveOrLoader>();
  private loadedDirectives = new Map<string, Type<unknown>>();
  private readonly metadataStore = RegistryMetadataStore.getInstance();

  private constructor() {}

  static getInstance(): DirectiveRegistry {
    if (!DirectiveRegistry.instance) {
      DirectiveRegistry.instance = new DirectiveRegistry();
    }
    return DirectiveRegistry.instance;
  }

  register(
    name: string,
    directive: Type<unknown> | DirectiveLoader,
    metadata?: RegistryMetadataRecord
  ): void {
    if (this.directives.has(name)) {
      console.warn(`Directive "${name}" is already registered. Overwriting...`);
    }

    this.directives.set(name, directive);
    if (!this.isLoader(directive)) {
      this.loadedDirectives.set(name, directive as Type<unknown>);
    } else {
      this.loadedDirectives.delete(name);
    }
    if (metadata != null && Object.keys(metadata).length > 0) {
      this.metadataStore.set(name, 'directive', metadata);
    }
  }

  async get(name: string): Promise<Type<unknown> | undefined> {
    if (this.loadedDirectives.has(name)) {
      return this.loadedDirectives.get(name);
    }

    const directiveOrLoader = this.directives.get(name);
    if (!directiveOrLoader) {
      return undefined;
    }

    if (this.isLoader(directiveOrLoader)) {
      try {
        const loader = directiveOrLoader as DirectiveLoader;
        const directive = await loader();
        this.loadedDirectives.set(name, directive);
        return directive;
      } catch (error) {
        console.error(`Failed to lazy load directive "${name}":`, error);
        return undefined;
      }
    }

    const directive = directiveOrLoader as Type<unknown>;
    this.loadedDirectives.set(name, directive);
    return directive;
  }

  getSync(name: string): Type<unknown> | undefined {
    if (this.loadedDirectives.has(name)) {
      return this.loadedDirectives.get(name);
    }

    const directiveOrLoader = this.directives.get(name);
    if (!directiveOrLoader || this.isLoader(directiveOrLoader)) {
      return undefined;
    }

    const directive = directiveOrLoader as Type<unknown>;
    this.loadedDirectives.set(name, directive);
    return directive;
  }

  has(name: string): boolean {
    return this.directives.has(name);
  }

  getAll(): Map<string, Type<unknown>> {
    return new Map(this.loadedDirectives);
  }

  unregister(name: string): boolean {
    this.metadataStore.remove(name);
    this.loadedDirectives.delete(name);
    return this.directives.delete(name);
  }

  clear(): void {
    for (const name of this.directives.keys()) {
      this.metadataStore.remove(name);
    }
    this.directives.clear();
    this.loadedDirectives.clear();
  }

  getMetadata(key: string): RegistryMetadataRecord | undefined {
    return this.metadataStore.getMetadata(key);
  }

  getAllWithMetadata(): Map<string, { directive: Type<unknown>; metadata?: RegistryMetadataRecord }> {
    const result = new Map<string, { directive: Type<unknown>; metadata?: RegistryMetadataRecord }>();
    for (const [name, directive] of this.loadedDirectives) {
      result.set(name, {
        directive,
        metadata: this.metadataStore.getMetadata(name),
      });
    }
    return result;
  }

  private isLoader(value: DirectiveOrLoader): value is DirectiveLoader {
    if (typeof value !== 'function') {
      return false;
    }
    // Class constructors have prototype.constructor === themselves; loader functions (e.g. arrow)
    // do not, so we treat only non-class functions with 0 args as loaders.
    const looksLikeClass =
      typeof (value as Type<unknown>).prototype !== 'undefined' &&
      (value as Type<unknown>).prototype?.constructor === value;
    return (value as DirectiveLoader).length === 0 && !looksLikeClass;
  }
}
