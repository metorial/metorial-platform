import { combineQueueProcessors } from '@metorial/queue';
import { oauthCleanupCron } from './cron/cleanup';
import { asyncAutoDiscoveryQueueProcessor } from './queue/asyncAutoDiscovery';
import { autoUpdateQueueProcessor } from './queue/autoUpdate';
import { configAutoDiscoveryQueueProcessor } from './queue/configAutoDiscovery';
import { errorCheckQueueProcessor } from './queue/errorCheck';

import './templates';

export * from './services';

export type { AuthForm } from './lib/formSchema';

export let providerOauthQueueProcessor = combineQueueProcessors([
  oauthCleanupCron,
  autoUpdateQueueProcessor,
  errorCheckQueueProcessor,
  asyncAutoDiscoveryQueueProcessor,
  configAutoDiscoveryQueueProcessor
]);
