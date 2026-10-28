import { combineQueueProcessors } from '@metorial/queue';
import './listeners/networking';
import { backfillProcessors } from './queues/backfill';
import { egressProcessors } from './queues/egress';
import { imageBuildProcessors } from './queues/imageBuild';
import { imageBuildCancelProcessors } from './queues/imageBuildCancel';
import { imageBuildUploadProcessors } from './queues/imageBuildUpload';
import { imageRemoteProcessors } from './queues/imageRemote';
import { searchProcessors } from './queues/search';
import { stalledImageBuildProcessors } from './queues/stalledImageBuilds';
import { syncImagesProcessors } from './queues/syncImages';
import { syncSpecsProcessors } from './queues/syncSpecs';

export {
  getRegional,
  sandboxTenantInclude,
  type SandboxDiskResizeFilter,
  type SandboxMachineEventFilter,
  type SandboxMachineInstanceFilter,
  type SandboxMachineOperationFilter,
  type SandboxMachineWithTenant,
  type SandboxTenantWithRegion
} from './lib/regional';
export * from './lib/failure';
export {
  machineExecDefaultTimeoutSeconds,
  machineExecMaxTimeoutSeconds
} from './lib/machineExec';
export * from './lib/publicRefs';
export { getRegionClient, getSandboxRegionConfigs, isSandboxingEnabled } from './lib/regions';
export { startSandboxBackfill } from './queues/backfill';
export * from './services';

export let sandboxQueueProcessor = combineQueueProcessors([
  backfillProcessors,
  egressProcessors,
  imageBuildProcessors,
  imageBuildCancelProcessors,
  imageBuildUploadProcessors,
  imageRemoteProcessors,
  searchProcessors,
  stalledImageBuildProcessors,
  syncImagesProcessors,
  syncSpecsProcessors
]);
