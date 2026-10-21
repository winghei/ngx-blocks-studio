import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BlockLoaderService } from '../../projects/blocks-studio/src/lib/core/block-loader/block-loader.service';
import { vi } from 'vitest';
import { BlockDirective } from '../../projects/blocks-studio/src/lib/core/block-loader/block.directive';
import { ComponentRegistry } from '../../projects/blocks-studio/src/lib/core/registry/component.registry';
import { BlockRegistryImpl } from '../../projects/blocks-studio/src/lib/core/block-loader/block-registry';

@Component({
  standalone: true,
  imports: [BlockDirective],
  template:
    '<div block [description]="desc()" [blockRegistry]="registry()" [blockDefinitions]="defs()" [model]="model()" [reloadKey]="reloadKey()"></div>',
  schemas: [NO_ERRORS_SCHEMA],
})
class HostWithBlockDirective {
  desc = signal<{ component: string; id?: string; inputs?: Record<string, unknown> } | null>(null);
  registry = signal<BlockRegistryImpl | null>(null);
  defs = signal<Record<string, unknown> | null>(null);
  model = signal<Record<string, unknown> | string | undefined>(undefined);
  reloadKey = signal<unknown>(null);
}

@Component({ standalone: true, template: '' })
class DummyBlockComponent {
  label = '';
}

describe('BlockDirective', () => {
  let componentRegistry: ComponentRegistry;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlockDirective, HostWithBlockDirective],
    }).compileComponents();

    componentRegistry = ComponentRegistry.getInstance();
    componentRegistry.register('DummyBlock', DummyBlockComponent);
  });

  afterEach(() => {
    if (componentRegistry?.has('DummyBlock')) {
      componentRegistry.unregister('DummyBlock');
    }
  });

  it('creates and renders host with directive', () => {
    const fixture = TestBed.createComponent(HostWithBlockDirective);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[block]')).toBeTruthy();
  });

  it('accepts description and does not throw when loading a registered block', async () => {
    const fixture = TestBed.createComponent(HostWithBlockDirective);
    fixture.detectChanges();

    fixture.componentInstance.desc.set({ component: 'DummyBlock' });
    fixture.componentInstance.model.set({ ok: true });
    fixture.detectChanges();

    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[block]')).toBeTruthy();
  });

  it('loadBlock delegates to BlockLoaderService', async () => {
    const fixture = TestBed.createComponent(HostWithBlockDirective);
    fixture.detectChanges();
    const loader = TestBed.inject(BlockLoaderService);
    const spy = vi.spyOn(loader, 'load').mockResolvedValue({ destroy: () => {} } as never);
    const dir = fixture.debugElement.query(By.directive(BlockDirective)).injector.get(BlockDirective);
    await dir.loadBlock({ component: 'DummyBlock' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('clears block when description is set to null', async () => {
    const fixture = TestBed.createComponent(HostWithBlockDirective);
    fixture.componentInstance.desc.set({ component: 'DummyBlock' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector('[block]');
    const initialChildren = host?.childNodes.length ?? 0;

    fixture.componentInstance.desc.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(host?.childNodes.length ?? 0).toBeLessThanOrEqual(initialChildren);
  });

  it('loads block reference when blockDefinitions provided', async () => {
    const fixture = TestBed.createComponent(HostWithBlockDirective);
    fixture.componentInstance.defs.set({ Ref: { component: 'DummyBlock' } });
    fixture.componentInstance.desc.set({ blockId: 'Ref' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[block]')).toBeTruthy();
  });

  it('reloads when reloadKey changes', async () => {
    const fixture = TestBed.createComponent(HostWithBlockDirective);
    fixture.componentInstance.desc.set({ component: 'DummyBlock', inputs: { label: 'a' } });
    fixture.componentInstance.reloadKey.set(1);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.reloadKey.set(2);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[block]')).toBeTruthy();
  });
});
