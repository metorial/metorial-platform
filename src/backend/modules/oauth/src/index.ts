import { combineQueueProcessors } from '@metorial/queue';
import { oauthCleanupCron } from './cron/cleanup';
import { autoUpdateQueueProcessor } from './queue/autoUpdate';

export * from './services';

export let oauthQueueProcessor = combineQueueProcessors([
  oauthCleanupCron,
  autoUpdateQueueProcessor
]);
