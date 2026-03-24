import { combineQueueProcessors } from '@metorial/queue';
import { cleanupCron } from './cron/cleanup';
import { expiresApiKeysProcessors } from './cron/expireKeys';
import { oauthJwkRotationCron } from './cron/oauthJwk';

export * from './services';

export let machineAccessQueueProcessor = combineQueueProcessors([
  expiresApiKeysProcessors,
  cleanupCron,
  oauthJwkRotationCron
]);
