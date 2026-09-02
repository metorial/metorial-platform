import { combineQueueProcessors } from '@metorial/queue';
import { cleanupOutpostInstanceLogsProcessors } from './cron/cleanupInstanceLogs';
import { cleanupOutpostInstancesProcessors } from './cron/cleanupInstances';
import { deactivateOutpostInstancesProcessors } from './cron/deactivateInstances';
import { expireOutpostCredentialsProcessors } from './cron/expireCredentials';
import { rotateOutpostTokenKeyPairsProcessors } from './cron/rotateKeyPairs';
import { registerOutpostCacheInvalidation } from './listeners/cacheInvalidation';

export * from './lib/cache';
export * from './lib/constants';
export * from './lib/services';
export * from './lib/tokens';
export * from './services';

registerOutpostCacheInvalidation();

export let outpostQueueProcessor = combineQueueProcessors([
  expireOutpostCredentialsProcessors,
  rotateOutpostTokenKeyPairsProcessors,
  deactivateOutpostInstancesProcessors,
  cleanupOutpostInstancesProcessors,
  cleanupOutpostInstanceLogsProcessors
]);
