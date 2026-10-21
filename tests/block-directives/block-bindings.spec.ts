import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component, Directive, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  getBlockInputsAndOutputs,
  resolveBlockInputsAndOutputs,
} from '../../projects/blocks-studio/src/lib/core/block-loader/block-bindings';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';

@Component({ standalone: true, template: '' })
class DecoratorTwoWayBlock {
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();
}

@Directive({ selector: '[hostBindingDir]', standalone: true })
class HostBindingDirective {
  @Input() ariaLabel = '';
  @Output() activated = new EventEmitter<void>();
}

describe('getBlockInputsAndOutputs', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecoratorTwoWayBlock],
    }).compileComponents();
  });

  it('treats @Input + *Change as two-way', () => {
    TestBed.createComponent(DecoratorTwoWayBlock);
    const meta = getBlockInputsAndOutputs([DecoratorTwoWayBlock]);
    expect(meta.twoWay.has('value')).toBe(true);
    expect(meta.inputs.has('value')).toBe(false);
    expect(meta.outputs.has('valueChange')).toBe(true);
  });

  it('reads inputs and outputs from a host directive type (ɵdir)', () => {
    TestBed.createComponent(DecoratorTwoWayBlock);
    const meta = getBlockInputsAndOutputs([HostBindingDirective]);
    expect(meta.inputs.has('ariaLabel')).toBe(true);
    expect(meta.outputs.has('activated')).toBe(true);
    expect(meta.twoWay.size).toBe(0);
  });

  it('merges metadata from component and host directives', () => {
    TestBed.createComponent(DecoratorTwoWayBlock);
    const meta = getBlockInputsAndOutputs([DecoratorTwoWayBlock, HostBindingDirective]);
    expect(meta.twoWay.has('value')).toBe(true);
    expect(meta.inputs.has('ariaLabel')).toBe(true);
    expect(meta.outputs.has('activated')).toBe(true);
  });
});

describe('resolveBlockInputsAndOutputs', () => {
  it('deep-resolves nested config with computed when templates are present', () => {
    const activitiesDataSetId = signal('ds-1');
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: {
        services: { AmsService: { activitiesDataSetId } },
        model: signal(undefined),
      },
    };
    const { resolvedInputs } = resolveBlockInputsAndOutputs(
      {
        inputs: {
          config: {
            data_set_id: "{{ ref('AmsService.activitiesDataSetId') }}",
            static: true,
          },
        },
      },
      new Set(['config']),
      new Set(),
      new Set(),
      ctx,
    );

    expect(resolvedInputs.config!()).toEqual({ data_set_id: 'ds-1', static: true });
    activitiesDataSetId.set('ds-2');
    expect(resolvedInputs.config!()).toEqual({ data_set_id: 'ds-2', static: true });
  });

  it('resolves inputs bound to host directive keys', () => {
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: { services: {}, model: signal(undefined) },
    };
    const { resolvedInputs } = resolveBlockInputsAndOutputs(
      { inputs: { ariaLabel: 'Save' } },
      new Set(['ariaLabel']),
      new Set(),
      new Set(),
      ctx,
    );

    expect(resolvedInputs.ariaLabel!()).toBe('Save');
  });

  it('throws on invalid two-way string mix', () => {
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: { services: {}, model: signal(undefined) },
    };
    expect(() =>
      resolveBlockInputsAndOutputs(
        { inputs: { title: '[(ref)] and {{ x }}' } },
        new Set(['title']),
        new Set(),
        new Set(),
        ctx,
      ),
    ).toThrow(/cannot be mixed/);
  });

  it('warns and skips unknown input keys', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: { services: {}, model: signal(undefined) },
    };
    resolveBlockInputsAndOutputs(
      { inputs: { unknownKey: 'x' } },
      new Set(['title']),
      new Set(),
      new Set(),
      ctx,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknownKey'));
    warn.mockRestore();
  });

  it('resolves nested arrays with template strings', () => {
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: {
        services: { S: { label: signal('hi') } },
        model: signal(undefined),
      },
    };
    const { resolvedInputs } = resolveBlockInputsAndOutputs(
      { inputs: { items: ["{{ ref('S.label') }}"] } },
      new Set(['items']),
      new Set(),
      new Set(),
      ctx,
    );
    expect(resolvedInputs.items!()).toEqual(['hi']);
  });

  it('keeps literal arrays without templates as static getters', () => {
    const items = [1, 2];
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: { services: {}, model: signal(undefined) },
    };
    const { resolvedInputs } = resolveBlockInputsAndOutputs(
      { inputs: { items } },
      new Set(['items']),
      new Set(),
      new Set(),
      ctx,
    );
    expect(resolvedInputs.items!()).toBe(items);
  });

  it('keeps literal object inputs as static getters when nothing needs resolve', () => {
    const config = { pivot_enabled: true };
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: { services: {}, model: signal(undefined) },
    };
    const { resolvedInputs } = resolveBlockInputsAndOutputs(
      { inputs: { config } },
      new Set(['config']),
      new Set(),
      new Set(),
      ctx,
    );

    expect(resolvedInputs.config!()).toBe(config);
  });

  it('binds registry input when component declares registry', () => {
    const reg = new BlockRegistryImpl();
    const ctx = {
      registry: reg,
      currentInstance: { services: {}, model: signal(undefined) },
    };
    const { resolvedInputs } = resolveBlockInputsAndOutputs(
      { inputs: {} },
      new Set(['registry']),
      new Set(),
      new Set(),
      ctx,
    );
    expect(resolvedInputs.registry!()).toBe(reg);
  });

  it('resolves flow template inputs', () => {
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: {
        services: {},
        model: signal({ label: 'L' }),
      },
    };
    const { resolvedInputs } = resolveBlockInputsAndOutputs(
      { inputs: { html: '${model.label}' } },
      new Set(['html']),
      new Set(),
      new Set(),
      ctx,
    );
    expect(resolvedInputs.html!()).toBe('L');
  });

  it('two-way binding with read-only signal uses linkedSignal', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: {
        services: { S: { title: computed(() => 'plain') } },
        model: signal(undefined),
      },
    };
    const { resolvedTwoWay, resolvedInputs } = resolveBlockInputsAndOutputs(
      { inputs: { title: '[(S.title)]' } },
      new Set(['title']),
      new Set(),
      new Set(['title']),
      ctx,
    );
    expect(warn).toHaveBeenCalled();
    expect(resolvedTwoWay.title!()).toBe('plain');
    expect(resolvedInputs.title!()).toBe('plain');
    warn.mockRestore();
  });

  it('creates output handlers for known outputs', () => {
    const fn = vi.fn();
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: { services: { H: { onClick: fn } }, model: signal({}) },
    };
    const { resolvedOutputs } = resolveBlockInputsAndOutputs(
      { outputs: { click: 'H.onClick', unknown: 'H.x' } },
      new Set(),
      new Set(['click', 'unknown']),
      new Set(),
      ctx,
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolvedOutputs.click!({ v: 1 });
    expect(fn).toHaveBeenCalled();
    resolveBlockInputsAndOutputs(
      { outputs: { bad: 'x' } },
      new Set(),
      new Set(['other']),
      new Set(),
      ctx,
    );
    warn.mockRestore();
  });

  it('assigns plain object to two-way and input getters', () => {
    const obj = { z: 1 };
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: { services: {}, model: signal(undefined) },
    };
    const { resolvedTwoWay, resolvedInputs } = resolveBlockInputsAndOutputs(
      { inputs: { data: obj } },
      new Set(['data']),
      new Set(),
      new Set(['data']),
      ctx,
    );
    expect(resolvedInputs.data!()).toEqual(obj);
    expect(resolvedTwoWay.data!()).toEqual(obj);
  });

  it('two-way and static values for object inputs', () => {
    const obj = { k: 1 };
    const ctx = {
      registry: new BlockRegistryImpl(),
      currentInstance: { services: {}, model: signal(undefined) },
    };
    const { resolvedTwoWay, resolvedInputs } = resolveBlockInputsAndOutputs(
      { inputs: { data: obj } },
      new Set(['data']),
      new Set(),
      new Set(['data']),
      ctx,
    );
    expect(resolvedInputs.data!()).toBe(obj);
    expect(resolvedTwoWay.data!()).toEqual(obj);
  });
});
