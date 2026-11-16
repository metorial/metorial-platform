import { runQueueProcessors } from '@lowerdeck/queue';
import { recoverEmailProcessors } from './queue/recoverEmail';
import { cleanupCron } from './cron/cleanup';
import { sendEmailQueueProcessor } from './queue/sendEmail';
import { sendEmailSingleQueueProcessor } from './queue/sendEmailSingle';

await runQueueProcessors([
  sendEmailSingleQueueProcessor,
  sendEmailQueueProcessor,
  cleanupCron,
  recoverEmailProcessors
]);
