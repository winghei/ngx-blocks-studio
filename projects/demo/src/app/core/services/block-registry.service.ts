import { Injectable } from '@angular/core';
import { BlockRegistryImpl, type BlockRegistry } from 'ngx-blocks-studio';

/**
 * Holds the block registry for the demo app so it can be injected
 * where needed (e.g. layout blocks that render child blocks).
 */
@Injectable({ providedIn: 'root' })
export class BlockRegistryService {
  readonly registry: BlockRegistry = new BlockRegistryImpl();
}
