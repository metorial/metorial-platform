import { combineQueueProcessors } from '@lowerdeck/queue';
import { slateInstanceConfigChangedQueueProcessor } from './configChanged';
import {
  createCredentialsUpdateEventQueueProcessor,
  createCredentialsUpdateEventsQueueProcessor
} from './credentials';
import { processAuthQueueProcessor } from './processAuth';
import { reconcileEventIdsQueueProcessor } from './reconcileEventIds';
import { updateProfileQueueProcessor } from './updateProfile';

export let instanceQueues = combineQueueProcessors([
  createCredentialsUpdateEventsQueueProcessor,
  createCredentialsUpdateEventQueueProcessor,
  slateInstanceConfigChangedQueueProcessor,
  processAuthQueueProcessor,
  updateProfileQueueProcessor,
  reconcileEventIdsQueueProcessor
]);
