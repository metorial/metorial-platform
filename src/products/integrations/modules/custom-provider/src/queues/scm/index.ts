import { combineQueueProcessors } from '@lowerdeck/queue';
import { scmSyncManyCron } from './cron';
import { handlePushQueueProcessor, processProviderPushQueueProcessor } from './handlePush';
import { scmSyncManyQueueProcessor } from './sync';

export let scmQueues = combineQueueProcessors([
  scmSyncManyCron,
  handlePushQueueProcessor,
  processProviderPushQueueProcessor,

  scmSyncManyQueueProcessor
]);
