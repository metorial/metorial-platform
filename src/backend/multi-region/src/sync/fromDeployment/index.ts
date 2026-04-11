import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  syncConsumerSurfacesCron,
  syncConsumerSurfacesManyQueueProcessor,
  syncConsumerSurfaceSingleQueueProcessor
} from './consumerSurface';
import {
  syncAppsCron,
  syncAppsManyQueueProcessor,
  syncOAuthAppSingleQueueProcessor
} from './oauth';
import {
  syncOrgsCron,
  syncOrgSingleQueueProcessor,
  syncOrgsManyQueueProcessor
} from './organization';
import {
  syncPortalsCron,
  syncPortalSingleQueueProcessor,
  syncPortalsManyQueueProcessor
} from './portal';
import {
  syncUsersCron,
  syncUserSingleQueueProcessor,
  syncUsersManyQueueProcessor
} from './user';

export let fromDeploymentSyncProcessors = combineQueueProcessors([
  syncOrgsCron,
  syncOrgsManyQueueProcessor,
  syncOrgSingleQueueProcessor,

  syncUsersCron,
  syncUsersManyQueueProcessor,
  syncUserSingleQueueProcessor,

  syncPortalsCron,
  syncPortalsManyQueueProcessor,
  syncPortalSingleQueueProcessor,

  syncConsumerSurfacesCron,
  syncConsumerSurfacesManyQueueProcessor,
  syncConsumerSurfaceSingleQueueProcessor,

  syncAppsCron,
  syncAppsManyQueueProcessor,
  syncOAuthAppSingleQueueProcessor
]);
