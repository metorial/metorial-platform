import { combineQueueProcessors } from '@metorial/queue';
import { oauthCleanupCron } from './cron/cleanup';
import { autoUpdateQueueProcessor } from './queue/autoUpdate';

export * from './services';

export let providerOauthQueueProcessor = combineQueueProcessors([
  oauthCleanupCron,
  autoUpdateQueueProcessor
]);

import './templates';
