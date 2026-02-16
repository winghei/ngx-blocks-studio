import { Injector, inject } from '@angular/core';
import { ComponentRegistry, ServiceRegistry } from 'ngx-blocks-studio';
import { FormStateService } from '../services/form-state.service';
import { AuthStateService } from '../services/auth-state.service';
import { DashboardStateService } from '../services/dashboard-state.service';
import { BlockHostComponent } from '../../blocks/block-host/block-host.component';
import { RowLayoutBlockComponent } from '../../blocks/layout/row-layout/row-layout-block.component';
import { SectionBlockComponent } from '../../blocks/layout/section/section-block.component';
import { StringInputBlockComponent } from '../../blocks/input/string-input/string-input-block.component';
import { NumberInputBlockComponent } from '../../blocks/input/number-input/number-input-block.component';

/**
 * Registers demo blocks, FormState, AuthState, DashboardState, and BlockHost with blocks-studio registries.
 * Call once at app init (e.g. APP_INITIALIZER). Pass injector when not in injection context.
 */
export function registerDemoBlocks(injector?: Injector): void {
  ServiceRegistry.getInstance().setInjector(injector ?? inject(Injector));

  ServiceRegistry.getInstance().register('FormState', FormStateService);
  ServiceRegistry.getInstance().register('AuthState', AuthStateService);
  ServiceRegistry.getInstance().register('DashboardState', DashboardStateService);

  ComponentRegistry.getInstance().register('RowLayout', RowLayoutBlockComponent);
  ComponentRegistry.getInstance().register('Section', SectionBlockComponent);
  ComponentRegistry.getInstance().register('StringInput', StringInputBlockComponent);
  ComponentRegistry.getInstance().register('NumberInput', NumberInputBlockComponent);

  ComponentRegistry.getInstance().register('BlockHost', BlockHostComponent);
  ComponentRegistry.getInstance().register('HtmlBlock', () =>
    import('../../blocks/html-block/html-block').then((m) => m.HtmlBlock)
  );
}
