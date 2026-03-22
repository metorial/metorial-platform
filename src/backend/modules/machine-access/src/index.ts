import { combineQueueProcessors } from '@metorial/queue';
import { cleanupCron } from './cron/cleanup';
import { expiresApiKeysProcessors } from './cron/expireKeys';

export * from './services';

export let machineAccessQueueProcessor = combineQueueProcessors([
  expiresApiKeysProcessors,
  cleanupCron
]);
