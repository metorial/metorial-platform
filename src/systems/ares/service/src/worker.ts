import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';

await runQueueProcessors([cleanupCron]);
