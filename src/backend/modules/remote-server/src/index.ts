import { combineQueueProcessors } from '@metorial/queue';
import { remoteServerCleanupCron } from './cron/cleanup';

export * from './services';

export let remoteServerQueueProcessor = combineQueueProcessors([remoteServerCleanupCron]);
