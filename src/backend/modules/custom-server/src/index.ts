import { combineQueueProcessors } from '@metorial/queue';
import { customServerCleanupCron } from './cron/cleanup';
import { checkRemoteQueueProcessor } from './queues/checkRemote';
import { initializeRemoteQueueProcessor } from './queues/initializeRemote';

export * from './services';

export let customServerQueueProcessor = combineQueueProcessors([
  customServerCleanupCron,
  checkRemoteQueueProcessor,
  initializeRemoteQueueProcessor
]);
