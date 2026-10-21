import type { BlockDescription } from './block-description.schema';
import { normalizeServices } from './block-description.schema';

/** Compact key for services to avoid JSON.stringify of large config in effect. */
export function getServicesKey(services: BlockDescription['services']): string {
  const arr = normalizeServices(services);
  if (arr.length === 0) return '';
  return arr
    .map((s) =>
      typeof s === 'string'
        ? s
        : `${(s as { id: string }).id}:${(s as { scope?: string }).scope ?? ''}`,
    )
    .join(',');
}

export function safeJsonKey(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return String(value);
  }
}
