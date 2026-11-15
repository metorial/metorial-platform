import { combineQueueProcessors } from '@metorial/queue';
import { cleanupCron } from './cron/cleanup';

export * from './services';

export let communityQueueProcessor = combineQueueProcessors([cleanupCron]);
