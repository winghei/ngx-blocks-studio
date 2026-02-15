/**
 * Parse ref paths and detect {{ref}} (read-only) and [(ref)] (two-way) in strings.
 */

const READONLY_REF_RE = /\{\{([^}]+)\}\}/g;
const TWOWAY_REF_RE = /^\[\(([^)]+)\)\]$/;

const PARSE_REF_PATH_CACHE_MAX = 64;
const parseRefPathCache = new Map<string, { blockId?: string; instancePath: string }>();

function parseRefPathUncached(refPath: string): { blockId?: string; instancePath: string } {
  const trimmed = refPath.trim();
  const parts = trimmed.split('.');
  if (parts.length >= 2 && parts[0] === 'instance') {
    return { instancePath: trimmed };
  }
  if (parts.length >= 3 && parts[1] === 'instance') {
    return { blockId: parts[0], instancePath: parts.slice(1).join('.') };
  }
  return { instancePath: trimmed };
}

export function parseRefPath(refPath: string): { blockId?: string; instancePath: string } {
  const cached = parseRefPathCache.get(refPath);
  if (cached) return cached;
  const result = parseRefPathUncached(refPath);
  if (parseRefPathCache.size >= PARSE_REF_PATH_CACHE_MAX) parseRefPathCache.clear();
  parseRefPathCache.set(refPath, result);
  return result;
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

/**
 * One trim + one pass: classify string for two-way ref handling. Use instead of calling
 * isInvalidTwoWayMix and isTwoWayRefString separately to avoid double trim/regex.
 */
export function classifyTwoWayString(value: unknown): 'two-way' | 'invalid-mix' | 'none' {
  if (typeof value !== 'string') return 'none';
  const s = value.trim();
  if (!s.includes('[(') && !s.includes(')]')) return 'none';
  return TWOWAY_REF_RE.test(s) ? 'two-way' : 'invalid-mix';
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
