import { combineQueueProcessors } from '@metorial/queue';
import { syncImagesProcessors } from './queues/syncImages';
import { syncSpecsProcessors } from './queues/syncSpecs';

export {
  getRegional,
  sandboxTenantInclude,
  type SandboxTenantWithRegion
} from './lib/regional';
export { getRegionClient, isSandboxingEnabled } from './lib/regions';
export * from './services';

export let sandboxQueueProcessor = combineQueueProcessors([
  syncImagesProcessors,
  syncSpecsProcessors
]);
