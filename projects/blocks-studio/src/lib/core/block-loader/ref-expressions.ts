/**
 * Parse ref paths and detect {{ref}} (read-only) and [(ref)] (two-way) in strings.
 */

const READONLY_REF_RE = /\{\{([^}]+)\}\}/g;
const TWOWAY_REF_RE = /^\[\(([^)]+)\)\]$/;

export function parseRefPath(refPath: string): { blockId?: string; instancePath: string } {
  const parts = refPath.trim().split('.');
  if (parts.length >= 2 && parts[0] === 'instance') {
    return { instancePath: refPath.trim() };
  }
  if (parts.length >= 3 && parts[1] === 'instance') {
    return { blockId: parts[0], instancePath: parts.slice(1).join('.') };
  }
  return { instancePath: refPath.trim() };
}

export function extractReadonlyRefs(template: string): string[] {
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  READONLY_REF_RE.lastIndex = 0;
  while ((m = READONLY_REF_RE.exec(template)) !== null) {
    const ref = m[1].trim();
    if (ref && !refs.includes(ref)) refs.push(ref);
  }
  return refs;
}

export function isTwoWayRefString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return TWOWAY_REF_RE.test(value.trim());
}

/**
 * True when a string contains two-way ref delimiters `[(` or `)]` but is not a valid
 * standalone two-way ref (exact form `[(refPath)]`). Mixing two-way with literals or {{ }} is invalid.
 */
export function isInvalidTwoWayMix(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  const hasDelimiters = s.includes('[(') || s.includes(')]');
  return hasDelimiters && !TWOWAY_REF_RE.test(s);
}

export function parseTwoWayRef(value: string): string | null {
  const m = value.trim().match(TWOWAY_REF_RE);
  return m ? m[1].trim() : null;
}

export function getRefPathFromReadonly(template: string, match: string): string {
  const re = new RegExp(`\\{\\{${escapeRe(match)}\\}\\}`, 'g');
  const m = re.exec(template);
  return m ? match : '';
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
