import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncAccountDomainToDeploymentQueueProcessor } from './accountDomain';
import { syncConsumerSurfaceToDeploymentQueueProcessor } from './consumerSurface';
import { syncGlobalProfileToDeploymentQueueProcessor } from './globalProfile';
import { syncInstanceToDeploymentQueueProcessor } from './instance';
import {
  reconcileOAuthAppSingleQueueProcessor,
  reconcileOAuthAppsCron,
  reconcileOAuthAppsManyQueueProcessor,
  syncOAuthAppToDeploymentQueueProcessor
} from './oauth';
import { syncOrganizationToDeploymentQueueProcessor } from './organization';
import { syncPortalToDeploymentQueueProcessor } from './portal';
import { syncSkillPluginToDeploymentQueueProcessor } from './skillPlugin';
import { syncCron, syncToDeploymentQueueProcessor } from './sync';
import { syncUserToDeploymentQueueProcessor } from './user';

export let toDeploymentSyncProcessors = combineQueueProcessors([
  syncToDeploymentQueueProcessor,
  syncAccountDomainToDeploymentQueueProcessor,
  syncGlobalProfileToDeploymentQueueProcessor,
  syncUserToDeploymentQueueProcessor,
  syncOrganizationToDeploymentQueueProcessor,
  syncPortalToDeploymentQueueProcessor,
  syncSkillPluginToDeploymentQueueProcessor,
  syncConsumerSurfaceToDeploymentQueueProcessor,
  syncOAuthAppToDeploymentQueueProcessor,
  reconcileOAuthAppsCron,
  reconcileOAuthAppsManyQueueProcessor,
  reconcileOAuthAppSingleQueueProcessor,
  syncInstanceToDeploymentQueueProcessor,
  syncCron
]);
