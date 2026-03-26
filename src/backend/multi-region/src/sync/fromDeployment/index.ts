import { combineQueueProcessors } from '@lowerdeck/queue';

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

  syncAppsCron,
  syncAppsManyQueueProcessor,
  syncOAuthAppSingleQueueProcessor
]);
