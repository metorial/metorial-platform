import { combineQueueProcessors } from '@lowerdeck/queue';
import { adminCleanupCron } from './cron/cleanup';

export * from './lib/adminApp';
export * from './services/admin';

export let adminQueueProcessor = combineQueueProcessors([adminCleanupCron]);
