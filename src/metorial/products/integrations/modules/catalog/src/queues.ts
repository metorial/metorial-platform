import { combineQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';

export let catalogQueueProcessor = combineQueueProcessors([cleanupCron]);
