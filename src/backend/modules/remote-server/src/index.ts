import { combineQueueProcessors } from '@metorial/queue';
import { remoteServerCleanupCron } from './cron/cleanup';
import { checkRemoteQueueProcessor } from './queue/checkRemote';

export * from './services';

export let remoteServerQueueProcessor = combineQueueProcessors([
  remoteServerCleanupCron,
  checkRemoteQueueProcessor
]);
