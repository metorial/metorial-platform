import { combineQueueProcessors } from '@lowerdeck/queue';

import './oauth';
import {
  syncAppsCron,
  syncAppsManyQueueProcessor,
  syncOAuthAppSingleQueueProcessor
} from './oauth';
import './organization';
import {
  syncOrgsCron,
  syncOrgSingleQueueProcessor,
  syncOrgsManyQueueProcessor
} from './organization';
import './user';
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
