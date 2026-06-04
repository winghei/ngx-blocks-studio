import type {
  BlockDescription,
  BlockOutputValue,
  SafeParseBlockDescriptionResult,
  ServiceEntry,
} from './block-description.types';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function validateParams(v: unknown, path: string): string | null {
  if (v === undefined) return null;
  if (Array.isArray(v)) return null;
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) return null;
  return `${path}: params must be array or record`;
}

function validateServiceEntry(v: unknown, path: string): string | null {
  if (isNonEmptyString(v)) return null;
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    return `${path}: invalid service entry`;
  const o = v as Record<string, unknown>;
  if (!isNonEmptyString(o['id'])) return `${path}: service object requires non-empty id`;
  if (o['scope'] !== undefined && o['scope'] !== 'self') return `${path}: invalid scope`;
  if (o['alias'] !== undefined && !isNonEmptyString(o['alias'])) return `${path}: invalid alias`;
  return null;
}

function validateThenChainStep(v: unknown, path: string): string | null {
  if (isNonEmptyString(v)) return null;
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    return `${path}: invalid then step`;
  const o = v as Record<string, unknown>;
  if (!isNonEmptyString(o['ref'])) return `${path}: then step object requires ref`;
  const p = validateParams(o['params'], `${path}.params`);
  if (p) return p;
  if (o['then'] !== undefined) {
    if (!Array.isArray(o['then'])) return `${path}.then must be an array`;
    for (let i = 0; i < o['then'].length; i++) {
      const e = validateThenChainStep(o['then'][i], `${path}.then[${i}]`);
      if (e) return e;
    }
  }
  return null;
}

function validateOnError(v: unknown, path: string): string | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return `${path}: invalid onError`;
  const o = v as Record<string, unknown>;
  if (!isNonEmptyString(o['ref'])) return `${path}: onError requires ref`;
  return validateParams(o['params'], `${path}.params`);
}

function validateOutputCallObject(v: unknown, path: string): string | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    return `${path}: invalid output object`;
  const o = v as Record<string, unknown>;
  if (!isNonEmptyString(o['ref'])) return `${path}: output object requires ref`;
  const p = validateParams(o['params'], `${path}.params`);
  if (p) return p;
  if (o['then'] !== undefined) {
    if (!Array.isArray(o['then'])) return `${path}.then must be an array`;
    for (let i = 0; i < o['then'].length; i++) {
      const e = validateThenChainStep(o['then'][i], `${path}.then[${i}]`);
      if (e) return e;
    }
  }
  if (o['onError'] !== undefined) {
    const e = validateOnError(o['onError'], `${path}.onError`);
    if (e) return e;
  }
  return null;
}

function validateOutputValue(v: unknown, path: string): string | null {
  if (isNonEmptyString(v)) return null;
  return validateOutputCallObject(v, path);
}

function validateBlockDescriptionShape(data: unknown): string | null {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return 'Expected an object';
  }
  const o = data as Record<string, unknown>;
  if (!isNonEmptyString(o['component'])) return 'component is required and must be non-empty';
  if (o['id'] !== undefined && !isNonEmptyString(o['id'])) return 'id must be a non-empty string';

  if (o['services'] !== undefined && o['services'] !== null) {
    const s = o['services'];
    const entries = Array.isArray(s) ? s : [s];
    for (let i = 0; i < entries.length; i++) {
      const e = validateServiceEntry(entries[i], `services[${i}]`);
      if (e) return e;
    }
  }

  if (o['directives'] !== undefined && o['directives'] !== null) {
    const d = o['directives'];
    if (isNonEmptyString(d)) {
      /* ok */
    } else if (Array.isArray(d)) {
      for (let i = 0; i < d.length; i++) {
        if (!isNonEmptyString(d[i])) return `directives[${i}] must be a non-empty string`;
      }
    } else {
      return 'directives must be a string or array of strings';
    }
  }

  if (o['inputs'] !== undefined && o['inputs'] !== null) {
    if (typeof o['inputs'] !== 'object' || Array.isArray(o['inputs'])) return 'inputs must be an object';
  }

  if (o['outputs'] !== undefined && o['outputs'] !== null) {
    if (typeof o['outputs'] !== 'object' || Array.isArray(o['outputs'])) return 'outputs must be an object';
    const outs = o['outputs'] as Record<string, unknown>;
    for (const key of Object.keys(outs)) {
      const e = validateOutputValue(outs[key], `outputs.${key}`);
      if (e) return e;
    }
  }

  return null;
}

export function safeParseBlockDescription(data: unknown): SafeParseBlockDescriptionResult {
  const message = validateBlockDescriptionShape(data);
  if (message) return { success: false, error: { message } };

  const o = data as Record<string, unknown>;
  const servicesRaw = o['services'];
  const services: ServiceEntry[] =
    servicesRaw == null
      ? []
      : Array.isArray(servicesRaw)
        ? (servicesRaw as ServiceEntry[])
        : [servicesRaw as ServiceEntry];

  const directivesRaw = o['directives'];
  const directives: string | string[] =
    directivesRaw == null ? [] : (directivesRaw as string | string[]);

  const result: BlockDescription = {
    component: o['component'] as string,
    services,
    directives,
  };
  if (o['id'] !== undefined) result.id = o['id'] as string;
  if (o['inputs'] !== undefined) result.inputs = o['inputs'] as Record<string, unknown>;
  if (o['outputs'] !== undefined) result.outputs = o['outputs'] as Record<string, BlockOutputValue>;

  return { success: true, data: result };
}
