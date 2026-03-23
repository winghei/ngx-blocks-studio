import { Injector, inject } from '@angular/core';
import {
  BlockDefinitionsRegistry,
  ComponentRegistry,
  DirectiveRegistry,
  ServiceRegistry
} from 'ngx-blocks-studio';

/**
 * Registers demo blocks, FormState, AuthState, DashboardState, and BlockHost with blocks-studio registries.
 * Call once at app init (e.g. APP_INITIALIZER). Pass injector when not in injection context.
 */
export function registerDemoBlocks(injector?: Injector): void {
  const serviceRegistry = ServiceRegistry.getInstance();
  serviceRegistry.setInjector(injector ?? inject(Injector));
  serviceRegistry.register('FormState', ()=> import('../services/form-state.service').then(m => m.FormStateService));

  const componentRegistry = ComponentRegistry.getInstance();
  componentRegistry.register('RowLayout', () =>
    import('../../blocks/layout/row-layout/row-layout-block.component').then(
      (m) => m.RowLayoutBlockComponent,
    ),
  );
  componentRegistry.register('Section', () =>
    import('../../blocks/layout/section/section-block.component').then(
      (m) => m.SectionBlockComponent,
    ),
  );
  componentRegistry.register('StringInput', () =>
    import('../../blocks/input/string-input/string-input-block.component').then(
      (m) => m.StringInputBlockComponent,
    ),
  );
  componentRegistry.register('NumberInput', () =>
    import('../../blocks/input/number-input/number-input-block.component').then(
      (m) => m.NumberInputBlockComponent,
    ),
  );
  componentRegistry.register('BlockHost', () =>
    import('../../blocks/block-host/block-host.component').then((m) => m.BlockHostComponent),
  );
  componentRegistry.register('HtmlBlock', () =>
    import('../../blocks/html-block/html-block').then((m) => m.HtmlBlock),
  );
  componentRegistry.register('LinkBlock', () =>
    import('../../blocks/link-block/link-block.component').then((m) => m.LinkBlockComponent),
  );
  componentRegistry.register('BlockFor', () =>
    import('../../blocks/block-for.component').then((m) => m.BlockForComponent),
  );

  const directiveRegistry = DirectiveRegistry.getInstance();
  directiveRegistry.register('MouseEvents', () =>
    import('../../directives/mouse-events.directive').then((m) => m.MouseEventsDirective),
  );
  directiveRegistry.register('Block', () =>
    import('ngx-blocks-studio').then((m) => m.BlockDirective),
  );

  const blockDefinitionsRegistry = BlockDefinitionsRegistry.getInstance();
  blockDefinitionsRegistry.register('AppNav', () =>
    import('../../route-data/nav.block').then((m) => m.appNavBlock),
  );
  blockDefinitionsRegistry.register('PersonForm', () =>
    import('../../route-data/person-form.block').then((m) => m.personFormBlock),
  );
  blockDefinitionsRegistry.register('DocsPage', () =>
    import('../../route-data/docs/index.block').then((m) => m.docsBlock),
  );
  blockDefinitionsRegistry.register('ExamplePage', () =>
    import('../../route-data/examples.block').then((m) => m.ExamplePageBlock),
  );
}
