import { runQueueProcessors } from '@mtsrc/queue';
import { cleanupCron } from './cron/cleanup';
import { sendEmailQueueProcessor } from './queue/sendEmail';
import { sendEmailSingleQueueProcessor } from './queue/sendEmailSingle';

await runQueueProcessors([
  sendEmailSingleQueueProcessor,
  sendEmailQueueProcessor,
  cleanupCron
]);
