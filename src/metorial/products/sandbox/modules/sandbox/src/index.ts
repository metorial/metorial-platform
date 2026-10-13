import { combineQueueProcessors } from '@metorial/queue';
import './listeners/networking';
import { egressProcessors } from './queues/egress';
import { imageBuildProcessors } from './queues/imageBuild';
import { imageBuildCancelProcessors } from './queues/imageBuildCancel';
import { imageRemoteProcessors } from './queues/imageRemote';
import { stalledImageBuildProcessors } from './queues/stalledImageBuilds';
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
  egressProcessors,
  imageBuildProcessors,
  imageBuildCancelProcessors,
  imageRemoteProcessors,
  stalledImageBuildProcessors,
  syncImagesProcessors,
  syncSpecsProcessors
]);
