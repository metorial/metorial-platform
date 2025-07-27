import { combineQueueProcessors } from '@metorial/queue';
import { customServerCleanupCron } from './cron/cleanup';

export * from './services';

export let customServerQueueProcessor = combineQueueProcessors([customServerCleanupCron]);
