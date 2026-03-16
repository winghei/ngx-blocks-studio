import { Injector, inject } from '@angular/core';
import {
  BlockDirective,
  ComponentRegistry,
  DirectiveRegistry,
  ServiceRegistry,
} from 'ngx-blocks-studio';
import { BlockHostComponent } from '../../blocks/block-host/block-host.component';
import { NumberInputBlockComponent } from '../../blocks/input/number-input/number-input-block.component';
import { StringInputBlockComponent } from '../../blocks/input/string-input/string-input-block.component';
import { RowLayoutBlockComponent } from '../../blocks/layout/row-layout/row-layout-block.component';
import { SectionBlockComponent } from '../../blocks/layout/section/section-block.component';
import { MouseEventsDirective } from '../../directives/mouse-events.directive';
import { FormStateService } from '../services/form-state.service';

/**
 * Registers demo blocks, FormState, AuthState, DashboardState, and BlockHost with blocks-studio registries.
 * Call once at app init (e.g. APP_INITIALIZER). Pass injector when not in injection context.
 */
export function registerDemoBlocks(injector?: Injector): void {
  ServiceRegistry.getInstance().setInjector(injector ?? inject(Injector));

  ServiceRegistry.getInstance().register('FormState', FormStateService);

  ComponentRegistry.getInstance().register('RowLayout', RowLayoutBlockComponent);
  ComponentRegistry.getInstance().register('Section', SectionBlockComponent);
  ComponentRegistry.getInstance().register('StringInput', StringInputBlockComponent);
  ComponentRegistry.getInstance().register('NumberInput', NumberInputBlockComponent);

  ComponentRegistry.getInstance().register('BlockHost', BlockHostComponent);
  ComponentRegistry.getInstance().register('HtmlBlock', () =>
    import('../../blocks/html-block/html-block').then((m) => m.HtmlBlock),
  );
  ComponentRegistry.getInstance().register('LinkBlock', () =>
    import('../../blocks/link-block/link-block.component').then((m) => m.LinkBlockComponent),
  );
  ComponentRegistry.getInstance().register('BlockFor', () =>
    import('../../blocks/block-for.component').then((m) => m.BlockForComponent),
  );

  DirectiveRegistry.getInstance().register('MouseEvents', MouseEventsDirective);
  DirectiveRegistry.getInstance().register('Block', BlockDirective);
}
