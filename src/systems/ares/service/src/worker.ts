import { runQueueProcessors } from '@mtsrc/queue';
import { cleanupCron } from './cron/cleanup';

await runQueueProcessors([cleanupCron]);
