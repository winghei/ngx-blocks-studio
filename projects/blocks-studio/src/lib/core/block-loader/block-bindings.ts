import {
  computed,
  isWritableSignal,
  linkedSignal,
  reflectComponentType,
  signal,
  type Type,
  WritableSignal,
} from '@angular/core';
import { BlockDescription } from './block-description.schema';
import { createOutputHandler } from './output-reference';
import { classifyTwoWayString, parseTwoWayRef } from './ref-expressions';
import { getRefSignal, ResolverContext } from './ref-resolver';
import {
  isPlainObject,
  resolveNestedTemplateValues,
  valueNeedsInputResolve,
} from './nested-template-resolve';
import { looksLikeFlowTemplate, resolveTemplateString } from './template-interpolation';

const NESTED_INPUT_RESOLVE_OPTIONS = {
  resolveTwoWayStringsAsReadonly: true,
  escapeFlowRefs: true,
} as const;

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

function isTwoWayInput(
  publicName: string,
  publicOutputKeys: Set<string>,
  inputDef: unknown,
  outputsRecord?: Record<string, unknown>,
): boolean {
  if (publicOutputKeys.has(`${publicName}Change`)) {
    return true;
  }
  // model(): def.outputs is { value: 'valueChange' } (key = input name, not *Change)
  if (outputsRecord?.[publicName] === `${publicName}Change`) {
    return true;
  }
  // model() and other compiler-marked two-way signal inputs (see def.inputs[name][1])
  return Array.isArray(inputDef) && !!inputDef[1];
}

type AngularTypeDef = {
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
};

/** Angular attaches `ɵcmp` / `ɵdir` at runtime; not on public `Type`. */
type TypeWithAngularDef = Type<unknown> & {
  ɵdir?: AngularTypeDef;
  ɵcmp?: AngularTypeDef;
};

function getDirectiveMetadata(type: Type<unknown>) {
  const angularType = type as TypeWithAngularDef;

  if (angularType.ɵcmp) {
    const mirror = reflectComponentType(type);
    if (mirror != null && mirror.inputs.length > 0) {
      const outputNames = new Set(mirror.outputs.map((o) => o.templateName));
      const twoWay: string[] = [];
      const inputs: string[] = [];
      for (const inp of mirror.inputs) {
        const name = inp.templateName;
        if (isTwoWayInput(name, outputNames, null, undefined)) {
          twoWay.push(name);
        } else {
          inputs.push(name);
        }
      }
      const outputs = mirror.outputs.map((o) => o.templateName);
      return { inputs, outputs, twoWay, isComponent: true };
    }
  }

  // Directives have ɵdir, Components have ɵcmp (fallback when mirror is empty)
  const def = angularType.ɵdir || angularType.ɵcmp;

  if (!def) return null;

  const inputsRecord = def.inputs || {};
  const outputsRecord = def.outputs || {};
  const publicInputs = Object.keys(inputsRecord);
  const publicOutputs = new Set(Object.keys(outputsRecord));

  const twoWay = publicInputs.filter((key) =>
    isTwoWayInput(key, publicOutputs, inputsRecord[key], outputsRecord),
  );

  return {
    inputs: publicInputs.filter((key) => !twoWay.includes(key)),
    outputs: [...publicOutputs].filter((key) => !twoWay.includes(key)),
    twoWay,
    isComponent: !!angularType.ɵcmp,
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

    if (Array.isArray(value) || isPlainObject(value)) {
      if (valueNeedsInputResolve(value)) {
        resolvedInputs[key] = computed(() =>
          resolveNestedTemplateValues(
            value,
            ctx,
            key,
            new WeakSet(),
            NESTED_INPUT_RESOLVE_OPTIONS,
          ),
        );
      } else if (inputKeys.has(key)) {
        resolvedInputs[key] = () => value;
      }
      if (twoWayKeys.has(key)) resolvedTwoWay[key] = signal(value);
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
