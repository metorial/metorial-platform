import { combineQueueProcessors } from '@lowerdeck/queue';
import { authenticationCleanupCron } from './cron/cleanup';

export * from './services/auth';
export * from './services/authBlock';

export let authenticationQueueProcessor = combineQueueProcessors([authenticationCleanupCron]);
