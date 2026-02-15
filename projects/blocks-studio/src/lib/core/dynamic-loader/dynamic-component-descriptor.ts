import { z } from 'zod';

/**
 * Service entry: either a registry name (string) or a self-scoped service
 * (same registry key, provider scoped to the current component instance).
 */
const ServiceEntrySchema = z.union([
  z.string().min(1),
  z.object({
    context: z.literal('self'),
    key: z.string().min(1),
  }),
]);

/**
 * JSON-only descriptor for dynamic component loading.
 * Validated at runtime; only JSON-serializable values are allowed.
 * Model is the combined input/output state passed to the block.
 * Input may contain nested descriptors (e.g. rows, columns) for layout components.
 */
export const DynamicComponentDescriptorSchema = z.object({
  component: z.string().min(1),
  /** Unique id for this block instance; used for registry and model refs (e.g. {{RegistrationForm.firstName}}). At most one instance per id per tree. */
  id: z.string().min(1).optional(),
  services: z.array(ServiceEntrySchema).optional().default([]),
  /** Combined input/output state passed to the block (one object). */
  model: z.unknown().optional(),
  /** Component inputs; may include rows/columns arrays of child descriptors for layout components. */
  input: z.record(z.string(), z.unknown()).optional(),
  /** Output names to subscribe to; handlers provided at load time. */
  output: z.array(z.string()).optional(),
});

export type DynamicComponentDescriptor = z.infer<
  typeof DynamicComponentDescriptorSchema
>;

export type ServiceEntry = DynamicComponentDescriptor['services'][number];

/**
 * Parse and validate a descriptor. Throws ZodError if invalid.
 */
export function parseDynamicComponentDescriptor(
  data: unknown
): DynamicComponentDescriptor {
  return DynamicComponentDescriptorSchema.parse(data);
}

/**
 * Safe parse: returns { success: true, data } or { success: false, error }.
 */
export function safeParseDynamicComponentDescriptor(data: unknown) {
  return DynamicComponentDescriptorSchema.safeParse(data);
}
