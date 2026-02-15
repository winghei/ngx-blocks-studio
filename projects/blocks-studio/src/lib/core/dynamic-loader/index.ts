export {
  DynamicComponentDescriptorSchema,
  type DynamicComponentDescriptor,
  type ServiceEntry,
  parseDynamicComponentDescriptor,
  safeParseDynamicComponentDescriptor,
} from './dynamic-component-descriptor';
export {
  type DynamicBlockRegistry,
  type BlockInstanceHandle,
  DynamicBlockRegistryImpl,
} from './dynamic-block-registry';
export { buildBlockData, type BuildBlockDataOptions, type BuildBlockDataResult } from './model-parser';
export {
  DynamicComponentLoaderService,
  type DynamicComponentLoadOptions,
  type DynamicComponentLoadResult,
} from './dynamic-component-loader.service';
export { BlockDirective } from './dynamic-component.directive';
