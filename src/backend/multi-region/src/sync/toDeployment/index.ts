import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncCron } from '@metorial-enterprise/federation-payment/src/cron/sync';
import { syncOAuthAppToDeploymentQueueProcessor } from './oauth';
import { syncToDeploymentQueueProcessor } from './sync';
import { syncUserToDeploymentQueueProcessor } from './user';

export let toDeploymentSyncProcessors = combineQueueProcessors([
  syncToDeploymentQueueProcessor,
  syncUserToDeploymentQueueProcessor,
  syncOAuthAppToDeploymentQueueProcessor,
  syncCron
]);
