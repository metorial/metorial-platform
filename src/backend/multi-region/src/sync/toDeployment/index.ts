import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncOAuthAppToDeploymentQueueProcessor } from './oauth';
import { syncToDeploymentQueueProcessor } from './sync';
import { syncUserToDeploymentQueueProcessor } from './user';

export let toDeploymentSyncProcessors = combineQueueProcessors([
  syncToDeploymentQueueProcessor,
  syncUserToDeploymentQueueProcessor,
  syncOAuthAppToDeploymentQueueProcessor
]);
