import type {
  BlockDescription,
  BlockInput,
  OutputCallObject,
  ServiceEntry,
} from './block-description.types';
import {
  BlockDefinitionsRegistry,
  type BlockDefinitionOrLoader,
  isBlockDefinitionLoader,
} from '../registry/block-definitions.registry';
export type {
  BlockDescription,
  BlockInput,
  BlockOutputValue,
  OutputCallObject,
  SafeParseBlockDescriptionResult,
  ServiceEntry,
  ThenChainStep,
} from './block-description.types';
export type { OutputOnError } from './block-description.types';

export { safeParseBlockDescription } from './block-description-validate';

async function resolveBlockDefinitionValue(
  raw: BlockDefinitionOrLoader,
): Promise<Record<string, unknown>> {
  if (isBlockDefinitionLoader(raw)) {
    return raw();
  }
  return raw;
}

/** @deprecated Use OutputCallObject */
export type OutputReference = OutputCallObject;

/** Normalize services to array. */
export function normalizeServices(services: BlockDescription['services']): ServiceEntry[] {
  if (services == null) return [];
  return Array.isArray(services) ? services : [services];
}

/** Normalize directives to array of directive ids. */
export function normalizeDirectives(directives: BlockDescription['directives']): string[] {
  if (directives == null) return [];
  return Array.isArray(directives) ? directives : [directives];
}

export function isOutputCallObject(value: unknown): value is OutputCallObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as OutputCallObject).ref === 'string' &&
    (value as OutputCallObject).ref.length > 0
  );
}

/** @deprecated Use isOutputCallObject */
export function isOutputReference(value: unknown): value is OutputReference {
  return isOutputCallObject(value);
}

/**
 * Reference to a registered block: { blockId: string, blockDefinition?: object }.
 * Resolution uses blockId only to look up the registered block description.
 * When blockDefinition is provided, it is deep-merged onto the base so only
 * specified properties override (e.g. inputs.model); other keys are preserved.
 */
export interface BlockReference {
  /** Used by isBlockReference only; resolution uses blockId. */
  id?: string;
  /** Registered block id used to resolve the block description. */
  blockId?: string;
  /** Override merged onto the resolved block; only specified keys (e.g. inputs) are applied. */
  blockDefinition?: Partial<BlockInput>;
}

export function isBlockReference(value: unknown): value is BlockReference {
  if (typeof value !== 'object' || value === null || 'component' in value) return false;
  const id = (value as BlockReference).id ?? (value as BlockReference).blockId;
  return typeof id === 'string' && id.length > 0;
}

/**
 * Deep-merge override onto base. Only keys present in override are changed; nested objects
 * are merged recursively so e.g. override.inputs.model does not remove base.inputs.rows.
 * Arrays and primitives in override replace the base value.
 */
export function deepMergeBlockDefinition(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = override[key];
    if (
      overrideVal != null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      baseVal != null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMergeBlockDefinition(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

/**
 * Resolve a block reference to a full description using optional per-call definitions
 * and the global BlockDefinitionsRegistry. Per-call blockDefinitions take precedence
 * over global entries. If blockDefinition is present, it is deep-merged onto the base;
 * otherwise returns a shallow copy of the base.
 *
 * Registry and per-call map entries may be plain objects or async loaders (same pattern
 * as ComponentRegistry / DirectiveRegistry).
 */
export async function resolveBlockReference(
  ref: BlockReference,
  blockDefinitions: Record<string, BlockDefinitionOrLoader> | null | undefined,
): Promise<Record<string, unknown>> {
  const blockId = ref.blockId;
  const id = ref.id;
  const registry: BlockDefinitionsRegistry = BlockDefinitionsRegistry.getInstance();
  if (!blockId || typeof blockId !== 'string')
    throw new Error('Block reference must have blockId.');

  let base: Record<string, unknown> | undefined;
  if (blockDefinitions && Object.prototype.hasOwnProperty.call(blockDefinitions, blockId)) {
    const raw = blockDefinitions[blockId] as BlockDefinitionOrLoader;
    base = await resolveBlockDefinitionValue(raw);
  } else {
    base = await registry.get(blockId);
  }

  if (base == null || typeof base !== 'object')
    throw new Error(`Block "${blockId}" has no definition.`);

  if (id != null && id !== '') {
    base = { ...base, id };
  }

  const overrides = ref.blockDefinition;
  if (overrides == null || typeof overrides !== 'object' || Object.keys(overrides).length === 0)
    return { ...base };
  return deepMergeBlockDefinition(base, overrides);
}
