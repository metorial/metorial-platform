import { combineQueueProcessors } from '@mtsrc/queue';
import { cleanupCron } from './cron/cleanup';

export let catalogQueueProcessor = combineQueueProcessors([cleanupCron]);
