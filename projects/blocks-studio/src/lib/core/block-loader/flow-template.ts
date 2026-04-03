import type { ResolverContext } from './ref-resolver';
import {
  getRefValue,
  getValueByPath,
  resolveRefPath,
} from './ref-resolver';

/** AST node types for flow template */
export type FlowNode =
  | { type: 'text'; value: string }
  | { type: 'ref'; refPath: string }
  | { type: 'if'; refPath: string; body: FlowNode[]; elseBody?: FlowNode[] }
  | { type: 'for'; itemVar: string; refPath: string; body: FlowNode[] };

/** Scope for @for (e.g. item, $index) */
export interface FlowScope {
  [key: string]: unknown;
}

export interface InterpretFlowOptions {
  /**
   * Called for each `text` node (e.g. to expand `{{ }}` inside flow bodies).
   * Defaults to identity.
   */
  interpolateText?: (segment: string) => string;
  /**
   * When set, `@if (…)` evaluates this instead of `resolveRefOrModel` (e.g. safe expressions + payload).
   */
  resolveCondition?: (expression: string, scope: FlowScope) => unknown;
  /**
   * When false, `${…}` values are appended without HTML escaping (e.g. output handler params). Default true.
   */
  escapeRefValues?: boolean;
}

/** Match ${refPath} at start of string (no g flag so match() returns groups). */
const REF_AT_START_RE = /^\$\{([^}]*)\}/;
const IF_PREFIX_RE = /^@if\s*\(/;
const FOR_PREFIX_RE = /^@for\s*\(/;

/** `s[openIdx] === '('` → index of matching `)`, or -1. */
function findMatchingParen(s: string, openIdx: number): number {
  let depth = 0;
  for (let k = openIdx; k < s.length; k++) {
    const c = s[k];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}

function findMatchingBrace(s: string, start: number): number {
  let depth = 1;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Parses a flow template string into an AST.
 * Supports: ${refPath}, @if (refPath) { ... }, @else { ... }, @for (item of refPath) { ... }
 */
export function parseFlowTemplate(template: string): FlowNode[] {
  const nodes: FlowNode[] = [];
  let i = 0;

  while (i < template.length) {
    const rest = template.slice(i);

    const ifPrefix = rest.match(IF_PREFIX_RE);
    if (ifPrefix) {
      const openParenIdx = i + ifPrefix[0].length - 1;
      const closeParenIdx = findMatchingParen(template, openParenIdx);
      if (closeParenIdx === -1) {
        nodes.push({ type: 'text', value: rest });
        break;
      }
      const refPath = template.slice(openParenIdx + 1, closeParenIdx).trim();
      let bodyOpen = closeParenIdx + 1;
      while (bodyOpen < template.length && /\s/.test(template[bodyOpen])) bodyOpen++;
      if (template[bodyOpen] !== '{') {
        nodes.push({ type: 'text', value: rest });
        break;
      }
      const bodyStart = bodyOpen + 1;
      const bodyEnd = findMatchingBrace(template, bodyStart);
      if (bodyEnd === -1) {
        nodes.push({ type: 'text', value: rest });
        break;
      }
      const body = template.slice(bodyStart, bodyEnd);
      let next = bodyEnd + 1;
      let elseBody: FlowNode[] | undefined;
      let cursor = next;
      while (cursor < template.length && /\s/.test(template[cursor] ?? '')) {
        cursor++;
      }
      if (template.startsWith('@else', cursor)) {
        let elseCursor = cursor + '@else'.length;
        while (elseCursor < template.length && /\s/.test(template[elseCursor] ?? '')) {
          elseCursor++;
        }
        if (template[elseCursor] === '{') {
          const elseEnd = findMatchingBrace(template, elseCursor + 1);
          if (elseEnd !== -1) {
            elseBody = parseFlowTemplate(template.slice(elseCursor + 1, elseEnd));
            next = elseEnd + 1;
          }
        }
      }
      nodes.push({ type: 'if', refPath, body: parseFlowTemplate(body), elseBody });
      i = next;
      continue;
    }

    const forPrefix = rest.match(FOR_PREFIX_RE);
    if (forPrefix) {
      const openParenIdx = i + forPrefix[0].length - 1;
      const closeParenIdx = findMatchingParen(template, openParenIdx);
      if (closeParenIdx === -1) {
        nodes.push({ type: 'text', value: rest });
        break;
      }
      const inner = template.slice(openParenIdx + 1, closeParenIdx).trim();
      const ofMatch = inner.match(/^(\w+)\s+of\s+([\s\S]+)$/);
      if (!ofMatch) {
        nodes.push({ type: 'text', value: rest });
        break;
      }
      const itemVar = ofMatch[1];
      const refPath = ofMatch[2].trim();
      let bodyOpen = closeParenIdx + 1;
      while (bodyOpen < template.length && /\s/.test(template[bodyOpen])) bodyOpen++;
      if (template[bodyOpen] !== '{') {
        nodes.push({ type: 'text', value: rest });
        break;
      }
      const bodyStart = bodyOpen + 1;
      const bodyEnd = findMatchingBrace(template, bodyStart);
      if (bodyEnd === -1) {
        nodes.push({ type: 'text', value: rest });
        break;
      }
      const body = template.slice(bodyStart, bodyEnd);
      nodes.push({ type: 'for', itemVar, refPath, body: parseFlowTemplate(body) });
      i = bodyEnd + 1;
      continue;
    }

    const refMatch = rest.match(REF_AT_START_RE);
    if (refMatch) {
      const refPath = refMatch[1].trim();
      nodes.push({ type: 'ref', refPath });
      i += refMatch[0].length;
      continue;
    }

    const nextAt = rest.search(/@(?:if|else|for)\s/);
    const nextDollar = rest.indexOf('${');
    let end: number;
    if (nextAt >= 0 && (nextDollar < 0 || nextAt < nextDollar)) end = i + nextAt;
    else if (nextDollar >= 0) end = i + nextDollar;
    else end = template.length;

    if (end > i) {
      nodes.push({ type: 'text', value: template.slice(i, end) });
      i = end;
    } else {
      nodes.push({ type: 'text', value: rest[0] ?? '' });
      i++;
    }
  }

  return nodes;
}

/** Collect all ref paths used in the AST (for reactivity). */
export function collectRefPaths(nodes: FlowNode[]): Set<string> {
  const paths = new Set<string>();
  function walk(ns: FlowNode[]) {
    for (const n of ns) {
      if (n.type === 'ref') paths.add(n.refPath);
      else if (n.type === 'if') {
        paths.add(n.refPath);
        walk(n.body);
        if (n.elseBody) walk(n.elseBody);
      } else if (n.type === 'for') {
        paths.add(n.refPath);
        walk(n.body);
      }
    }
  }
  walk(nodes);
  return paths;
}

function escapeHtml(s: string): string {
  const el = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (el) {
    el.textContent = s;
    return el.innerHTML;
  }
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveInScope(refPath: string, scope: FlowScope): unknown {
  const parts = refPath.trim().split('.');
  let v: unknown = scope[parts[0]];
  for (let i = 1; i < parts.length && v !== undefined && v !== null; i++) {
    v = (v as Record<string, unknown>)[parts[i]];
  }
  return v;
}

function isTruthyFlowValue(value: unknown): boolean {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false;
    }
    return true;
  }
  return !!value;
}

/**
 * Same resolution rules as `interpolateTemplateMixed` for refs: named block ref, else current block `model` path.
 */
export function resolveRefOrModel(refPath: string, ctx: ResolverContext): unknown {
  const ref = refPath.trim();
  if (!ref) return undefined;
  const resolved = resolveRefPath(ref, ctx);
  if (resolved != null) {
    return getRefValue(ref, ctx);
  }
  return getValueByPath(ctx.currentInstance?.model?.() ?? {}, ref);
}

/**
 * Interprets the AST with the given resolver context and optional scope (e.g. item, $index).
 * Escapes interpolated values for safe innerHTML.
 */
export function interpretFlow(
  nodes: FlowNode[],
  ctx: ResolverContext,
  scope: FlowScope = {},
  options?: InterpretFlowOptions,
): string {
  const interpText = options?.interpolateText ?? ((s: string) => s);
  const escapeRefs = options?.escapeRefValues !== false;
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text') {
      out += interpText(node.value);
      continue;
    }
    if (node.type === 'ref') {
      const refPath = node.refPath.trim();
      const firstSegment = refPath.split('.')[0];
      let value: unknown;
      if (firstSegment && firstSegment in scope) {
        value = resolveInScope(refPath, scope);
      } else {
        value = resolveRefOrModel(refPath, ctx);
      }
      if (value !== undefined && value !== null) {
        const chunk = String(value);
        out += escapeRefs ? escapeHtml(chunk) : chunk;
      }
      continue;
    }
    if (node.type === 'if') {
      const rawExpr = node.refPath.trim();
      const cond = options?.resolveCondition
        ? options.resolveCondition(rawExpr, scope)
        : resolveRefOrModel(rawExpr, ctx);
      if (isTruthyFlowValue(cond)) {
        out += interpretFlow(node.body, ctx, scope, options);
      } else if (node.elseBody?.length) {
        out += interpretFlow(node.elseBody, ctx, scope, options);
      }
      continue;
    }
    if (node.type === 'for') {
      const arr = resolveRefOrModel(node.refPath, ctx);
      const list = Array.isArray(arr) ? arr : [];
      for (let idx = 0; idx < list.length; idx++) {
        out += interpretFlow(node.body, ctx, {
          ...scope,
          [node.itemVar]: list[idx],
          $index: idx,
        }, options);
      }
      continue;
    }
  }
  return out;
}

/** True if the string uses flow syntax (not plain `{{ }}` only). */
export function looksLikeFlowTemplate(s: string): boolean {
  return /@(?:if|for)\s*\(/.test(s) || /\$\{[^}]+\}/.test(s);
}
