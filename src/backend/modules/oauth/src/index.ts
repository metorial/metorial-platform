import { combineQueueProcessors } from '@metorial/queue';
import { oauthCleanupCron } from './cron/cleanup';
import { autoUpdateQueueProcessor } from './queue/autoUpdate';
import { errorCheckQueueProcessor } from './queue/errorCheck';

export * from './services';

export let providerOauthQueueProcessor = combineQueueProcessors([
  oauthCleanupCron,
  autoUpdateQueueProcessor,
  errorCheckQueueProcessor
]);
