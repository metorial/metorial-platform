import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncConsumerSurfaceToDeploymentQueueProcessor } from './consumerSurface';
import { syncOAuthAppToDeploymentQueueProcessor } from './oauth';
import { syncOrganizationToDeploymentQueueProcessor } from './organization';
import { syncPortalToDeploymentQueueProcessor } from './portal';
import { syncCron, syncToDeploymentQueueProcessor } from './sync';
import { syncUserToDeploymentQueueProcessor } from './user';

export let toDeploymentSyncProcessors = combineQueueProcessors([
  syncToDeploymentQueueProcessor,
  syncUserToDeploymentQueueProcessor,
  syncOrganizationToDeploymentQueueProcessor,
  syncPortalToDeploymentQueueProcessor,
  syncConsumerSurfaceToDeploymentQueueProcessor,
  syncOAuthAppToDeploymentQueueProcessor,
  syncCron
]);
