import { computed, isWritableSignal, linkedSignal, signal, WritableSignal } from '@angular/core';
import { BlockDescription } from './block-description.schema';
import { createOutputHandler } from './output-reference';
import { classifyTwoWayString, parseTwoWayRef } from './ref-expressions';
import { getRefSignal, ResolverContext } from './ref-resolver';
import { looksLikeFlowTemplate, resolveTemplateString } from './template-interpolation';

export function getBlockInputsAndOutputs(componentOrDirectives: any[]): {
  inputs: Set<string>;
  outputs: Set<string>;
  twoWay: Set<string>;
} {
  const inputs = new Set<string>();
  const outputs = new Set<string>();
  const twoWay = new Set<string>();

  for (const componentOrDirective of componentOrDirectives) {
    const metadata = getDirectiveMetadata(componentOrDirective);
    if (!metadata) continue;
    metadata.inputs.forEach((input) => inputs.add(input));
    metadata.outputs.forEach((output) => outputs.add(output));
    metadata.twoWay.forEach((twoWayKey) => twoWay.add(twoWayKey));
  }
  return { inputs, outputs, twoWay };
}

function getDirectiveMetadata(type: any) {
  // Directives have ɵdir, Components have ɵcmp
  const def = type.ɵdir || type.ɵcmp;

  if (!def) return null;

  // def.inputs and def.outputs are objects where:
  // Key = Public Template Name (alias)
  // Value = Internal Class Property Name
  const publicInputs = Object.keys(def.inputs || {});
  const publicOutputs = Object.keys(def.outputs || {});

  const twoWay = publicInputs.filter(
    (key) => publicOutputs.includes(`${key}Change`) && def.inputs[key][1],
  );

  return {
    inputs: publicInputs.filter((key) => !twoWay.includes(key)),
    outputs: publicOutputs.filter((key) => !twoWay.includes(key)),
    twoWay,
    isComponent: !!type.ɵcmp,
  };
}

export function resolveBlockInputsAndOutputs(
  description: BlockDescription,
  inputKeys: Set<string>,
  outputKeys: Set<string>,
  twoWayKeys: Set<string>,
  ctx: ResolverContext,
) {
  const resolvedInputs: Record<string, () => unknown> = {};
  const resolvedOutputs: Record<string, (value: unknown) => void> = {};
  const resolvedTwoWay: Record<string, WritableSignal<unknown>> = {};

  const inputs = description.inputs ?? {};
  const outputs = description.outputs ?? {};

  if (inputKeys.has('registry')) {
    resolvedInputs['registry'] = () => ctx.registry;
  }

  for (const [key, value] of Object.entries(inputs)) {
    if (!inputKeys.has(key) && !twoWayKeys.has(key)) {
      console.warn(
        `Block input "${key}" is not defined on the component or any host directive; skipping.`,
      );
      continue;
    }
    if (typeof value === 'string') {
      const twoWayKind = classifyTwoWayString(value);
      if (twoWayKind === 'invalid-mix') {
        throw new Error(
          `Invalid input "${String(key)}": two-way ref "[( )]" cannot be mixed with literals or "{{ }}". ` +
            `Use exactly "[(refPath)]" for two-way or "{{ refPath }}" for read-only.`,
        );
      }

      if (twoWayKind === 'two-way') {
        const refPath = parseTwoWayRef(value);
        if (refPath) {
          const valueSignal = getRefSignal(refPath, ctx);

          if (twoWayKeys.has(key))
            if (!isWritableSignal(valueSignal)) {
              console.warn(
                `Input "${key}" of ref "${refPath}" is a two-way ref but is not a writable signal. Path might not be resolved correctly.`,
              );
              resolvedTwoWay[key] = linkedSignal(() => valueSignal?.());
            } else {
              resolvedTwoWay[key] = valueSignal;
            }
          if (inputKeys.has(key))
            resolvedInputs[key] = computed(() => {
              return valueSignal?.();
            });
        }
        continue;
      }

      const str = value as string;
      const hasMustache =
        typeof value === 'string' &&
        str.indexOf('{{') !== -1 &&
        str.indexOf('}}', str.indexOf('{{')) !== -1;
      const hasFlow = typeof value === 'string' && looksLikeFlowTemplate(str);
      if (hasMustache || hasFlow) {
        resolvedInputs[key] = computed(() =>
          resolveTemplateString(str, ctx, undefined, { escapeFlowRefs: true }),
        );
        continue;
      }
    }

    if (Array.isArray(value)) {
      resolvedInputs[key] = computed(() =>
        value.map((item) => {
          if (typeof item === 'string') {
            return resolveTemplateString(item, ctx, undefined, { escapeFlowRefs: true });
          }

          return item;
        }),
      );

      continue;
    }

    if (inputKeys.has(key)) resolvedInputs[key] = () => value;
    if (twoWayKeys.has(key)) resolvedTwoWay[key] = signal(value);
  }

  for (const [key, value] of Object.entries(outputs)) {
    if (!outputKeys.has(key)) {
      console.warn(
        `Block output "${key}" is not defined on the component or any host directive; skipping.`,
      );
      continue;
    }

    resolvedOutputs[key] = createOutputHandler(value, key, ctx);
  }

  return { resolvedInputs, resolvedOutputs, resolvedTwoWay };
}
