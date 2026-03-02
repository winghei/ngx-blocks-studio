import { z } from 'zod';
import { BlockDefinitionsRegistry } from './block-definitions.registry';

/**
 * Service entry: root-scoped (string id or { id, alias? } with no scope) or self-scoped ({ id, scope: "self", alias? }).
 * When scope is omitted or undefined, the service is resolved from the root injector.
 */
const ServiceEntrySchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    scope: z.literal('self').optional(),
    alias: z.string().min(1).optional(),
  }),
]);

/**
 * Output handler: empty (use directive-provided handler) or reference-based (call method on ref).
 */
const OutputReferenceSchema = z.object({
  type: z.literal('reference'),
  reference: z.string().min(1),
  method: z.string().min(1),
  params: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
  then: z
    .array(
      z.object({
        reference: z.string().min(1),
        method: z.string().min(1),
        params: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
      }),
    )
    .optional(),
  onSuccess: z
    .object({
      reference: z.string().min(1),
      method: z.string().min(1),
      params: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
    })
    .optional(),
  onError: z
    .object({
      reference: z.string().min(1),
      method: z.string().min(1),
      params: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
    })
    .optional(),
});

const OutputValueSchema = z.union([z.record(z.string(), z.unknown()), OutputReferenceSchema]);

/**
 * Block description: JSON-serializable descriptor for dynamic block loading.
 * Refs in inputs use instance namespace: instance.FormState.firstName or UserForm.instance.FormState.firstName.
 */
export const BlockDescriptionSchema = z.object({
  component: z.string().min(1),
  id: z.string().min(1).optional(),
  services: z
    .union([ServiceEntrySchema, z.array(ServiceEntrySchema)])
    .optional()
    .default([]),
  inputs: z.record(z.string(), z.unknown()).optional(),
  outputs: z.record(z.string(), OutputValueSchema).optional(),

});

export type BlockDescription = z.infer<typeof BlockDescriptionSchema>;
export type BlockInput = z.input<typeof BlockDescriptionSchema>;
export type ServiceEntry = z.infer<typeof ServiceEntrySchema>;
export type OutputReference = z.infer<typeof OutputReferenceSchema>;

/** Normalize services to array. */
export function normalizeServices(services: BlockDescription['services']): ServiceEntry[] {
  if (services == null) return [];
  return Array.isArray(services) ? services : [services];
}

export function safeParseBlockDescription(
  data: unknown,
): ReturnType<typeof BlockDescriptionSchema.safeParse> {
  return BlockDescriptionSchema.safeParse(data);
}

export function isOutputReference(value: unknown): value is OutputReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as OutputReference).type === 'reference' &&
    typeof (value as OutputReference).reference === 'string' &&
    typeof (value as OutputReference).method === 'string'
  );
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
 */
export function resolveBlockReference(
  ref: BlockReference,
  blockDefinitions: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const blockId = ref.blockId;
  const id = ref.id;
  const registry: BlockDefinitionsRegistry = BlockDefinitionsRegistry.getInstance();
  if (!blockId || typeof blockId !== 'string')
    throw new Error('Block reference must have blockId.');

  let base: unknown;
  if (blockDefinitions && Object.prototype.hasOwnProperty.call(blockDefinitions, blockId)) {
    base = blockDefinitions[blockId];
  } else {
    base = registry.get(blockId);
  }

  if (base == null || typeof base !== 'object')
    throw new Error(`Block "${blockId}" has no definition.`);

  const baseObj = { ...base, id };

  const overrides = ref.blockDefinition;
  if (overrides == null || typeof overrides !== 'object' || Object.keys(overrides).length === 0)
    return { ...baseObj };
  return deepMergeBlockDefinition(baseObj, overrides);
}
