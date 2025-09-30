import { combineQueueProcessors } from '@metorial/queue';
import { customServerCleanupCron } from './cron/cleanup';
import { checkRemoteQueueProcessor } from './queues/checkRemote';
import { initializeLambdaQueueProcessor } from './queues/initializeLambda';
import { initializeRemoteQueueProcessor } from './queues/initializeRemote';

export * from './services';
export * from './templates';

export let customServerQueueProcessor = combineQueueProcessors([
  customServerCleanupCron,
  checkRemoteQueueProcessor,
  initializeLambdaQueueProcessor,
  initializeRemoteQueueProcessor
]);
