import { combineQueueProcessors } from '@metorial/queue';
import { customServerCleanupCron } from './cron/cleanup';
import { checkRemoteQueueProcessor } from './queues/checkRemote';

export * from './services';

export let customServerQueueProcessor = combineQueueProcessors([
  customServerCleanupCron,
  checkRemoteQueueProcessor
]);
