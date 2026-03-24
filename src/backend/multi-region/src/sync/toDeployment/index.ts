import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncToDeploymentQueueProcessor } from './sync';
import { syncUserToDeploymentQueueProcessor } from './user';

export let toDeploymentSyncProcessors = combineQueueProcessors([
  syncToDeploymentQueueProcessor,
  syncUserToDeploymentQueueProcessor
]);
