import { combineQueueProcessors } from '@lowerdeck/queue';
import { syncCallbackQueueProcessor } from './queues/syncCallback';
import { syncCleanupCron } from './cron/cleanup';

export * from './lib/syncEvents';
export * from './queues/syncCallback';

export let syncQueueProcessor = combineQueueProcessors([
  syncCallbackQueueProcessor,
  syncCleanupCron
]);
