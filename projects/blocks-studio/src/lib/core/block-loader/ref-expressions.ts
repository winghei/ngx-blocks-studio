/**
 * Parse ref paths and detect {{ref}} (read-only) and [(ref)] (two-way) in strings.
 */

const READONLY_REF_RE = /\{\{([^}]+)\}\}/g;
const TWOWAY_REF_RE = /^\[\(([^)]+)\)\]$/;

export interface ParsedRefPath {
  blockId?: string;
  serviceOrModel: string;
  pathParts: string[];
}

const PARSE_REF_PATH_CACHE_MAX = 64;
const parseRefPathCache = new Map<string, ParsedRefPath>();

/**
 * Parse ref path in the form "BlockID:model.info.title" or "model.info.title".
 * - With colon: first segment before ":" is block id, rest is instance path (service/model + property path).
 * - Without colon: current block; entire string is instance path (service/model + property path).
 * - Single segment (e.g. "age"): model path fallback when ref resolution returns null.
 */
function parseRefPathUncached(refPath: string): ParsedRefPath {
  const trimmed = refPath.trim();
  const colonIndex = trimmed.indexOf(':');

  if (colonIndex !== -1) {
    const prefix = trimmed.slice(0, colonIndex).trim();
    const rest = trimmed.slice(colonIndex + 1).trim();
    // BlockID must not contain a dot (so "BlockID:model.info.title" is valid; "a:b:c" → prefix "a", rest "b:c")
    if (prefix.length > 0 && !prefix.includes('.')) {
      const pathParts = rest.split('.').filter(Boolean);
      return { blockId: prefix, serviceOrModel: pathParts[0], pathParts: pathParts.slice(1) };
    } else {
      throw new Error(`Invalid block id: ${prefix}`);
    }
  }

  if (trimmed.includes('.')) {
    const pathParts = trimmed.split('.').filter(Boolean);
    return { serviceOrModel: pathParts[0], pathParts: pathParts.slice(1) };
  } else {
    return { serviceOrModel: '', pathParts: [trimmed] };
  }
}

export function parseRefPath(refPath: string): ParsedRefPath {
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
