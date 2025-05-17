import { combineQueueProcessors } from '@metorial/queue';
import { cleanupCron } from './cron/cleanup';
import { sendEmailQueueProcessor } from './queue/sendEmail';
import { sendEmailSingleQueueProcessor } from './queue/sendEmailSingle';

export * from './sendWithTemplate';
export * from './services';
export * from './templates';

export let emailQueueProcessor = combineQueueProcessors([
  cleanupCron,
  sendEmailQueueProcessor,
  sendEmailSingleQueueProcessor
]);
