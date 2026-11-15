import { combineQueueProcessors } from '@lowerdeck/queue';
import { appCleanupCron } from './cron/cleanup';

export * from './services/accessGroup';
export * from './services/oauthProvider';

export let appQueueProcessor = combineQueueProcessors([appCleanupCron]);
