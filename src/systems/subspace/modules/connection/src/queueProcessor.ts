import { combineQueueProcessors } from '@mtsrc/queue';
import { connectionCleanupCron } from './cron/cleanup';
import { queues } from './queues';

export let connectionQueueProcessor = combineQueueProcessors([queues, connectionCleanupCron]);
