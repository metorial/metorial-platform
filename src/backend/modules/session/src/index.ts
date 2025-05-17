import { combineQueueProcessors } from '@metorial/queue';
import { checkSessionsProcessors } from './cron/check';

export * from './connection';
export * from './services';

export let sessionQueueProcessor = combineQueueProcessors([checkSessionsProcessors]);
