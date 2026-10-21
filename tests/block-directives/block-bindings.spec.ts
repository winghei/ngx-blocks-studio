import { describe, it, expect, beforeEach } from 'vitest';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { getBlockInputsAndOutputs } from '../../projects/blocks-studio/src/lib/core/block-loader/block-bindings';

@Component({ standalone: true, template: '' })
class DecoratorTwoWayBlock {
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();
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

});
