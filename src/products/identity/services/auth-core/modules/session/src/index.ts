import { combineQueueProcessors } from '@lowerdeck/queue';
import { sessionCleanupCron } from './cron/cleanup';

export * from './services/device';
export * from './services/session';

export let sessionQueueProcessor = combineQueueProcessors([sessionCleanupCron]);
