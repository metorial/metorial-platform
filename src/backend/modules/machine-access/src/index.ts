import { combineQueueProcessors } from '@metorial/queue';
import { cleanupCron } from './cron/cleanup';
import { expiresApiKeysProcessors } from './cron/expireKeys';
import { oauthJwkRotationCron } from './cron/oauthJwk';
import {
  notifyExpiredApiKeyAdminsQueueProcessor
} from './queues/notifyExpiredApiKeyAdmins';
import { sendExpiredApiKeyEmailQueueProcessor } from './queues/sendExpiredApiKeyEmail';

export * from './services';

export let machineAccessQueueProcessor = combineQueueProcessors([
  expiresApiKeysProcessors,
  notifyExpiredApiKeyAdminsQueueProcessor,
  sendExpiredApiKeyEmailQueueProcessor,
  cleanupCron,
  oauthJwkRotationCron
]);
