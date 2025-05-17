import { combineQueueProcessors } from '@metorial/queue';
import { secretCleanupCron } from './cron/cleanup';

export type { SecretType } from './definitions';
export * from './services';
export * from './store';

export let secretQueueProcessor = combineQueueProcessors([secretCleanupCron]);
