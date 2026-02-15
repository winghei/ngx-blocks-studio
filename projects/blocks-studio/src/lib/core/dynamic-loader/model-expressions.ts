/**
 * Expression syntax for model strings:
 * - {{RefId.path.to.prop}} = readonly (computed)
 * - [(RefId.path.to.prop)] = two-way binding (signal ref or computed + effect)
 */

export const READONLY_PATTERN = /\{\{([^}]+)\}\}/g;
export const WRITABLE_PATTERN = /^\[\(([^)]+)\)\]$/;

export interface ParsedRef {
  refId: string;
  path: string[];
}

/**
 * Parse "RefId.path.to.prop" into { refId, path: ['path','to','prop'] }.
 */
export function parseRef(refPath: string): ParsedRef {
  const trimmed = refPath.trim();
  const dot = trimmed.indexOf('.');
  if (dot === -1) {
    return { refId: trimmed, path: [] };
  }
  const refId = trimmed.slice(0, dot);
  const pathStr = trimmed.slice(dot + 1);
  const path = pathStr ? pathStr.split('.').map((p) => p.trim()) : [];
  return { refId, path };
}

/**
 * Check if string is exactly a writable ref e.g. "[(RegistrationForm.firstName)]".
 */
export function isWritableRefString(s: string): boolean {
  return WRITABLE_PATTERN.test(s.trim());
}

/** Pattern for writable ref anywhere in string (no ^$). */
const WRITABLE_ANYWHERE = /\[\([^)]+\)\]/;

/**
 * Check if string contains a writable ref anywhere (for case 5 rejection).
 */
export function containsWritableRef(s: string): boolean {
  return WRITABLE_ANYWHERE.test(s);
}

/**
 * Extract all {{...}} refs from a string (for readonly interpolation).
 */
export function extractReadonlyRefs(s: string): string[] {
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(READONLY_PATTERN.source, 'g');
  while ((m = re.exec(s)) !== null) {
    refs.push(m[1].trim());
  }
  return refs;
}
