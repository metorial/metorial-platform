import { combineQueueProcessors } from '@lowerdeck/queue';
import { handlePushQueueProcessor, processProviderPushQueueProcessor } from './handlePush';
import { scmSyncManyQueueProcessor } from './sync';

export let scmQueues = combineQueueProcessors([
  handlePushQueueProcessor,
  processProviderPushQueueProcessor,

  scmSyncManyQueueProcessor
]);
