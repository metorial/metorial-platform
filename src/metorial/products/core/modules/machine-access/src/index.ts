import { combineQueueProcessors } from '@metorial/queue';
import { cleanupCron } from './cron/cleanup';
import { expiresApiKeysProcessors } from './cron/expireKeys';
import { oauthJwkRotationCron } from './cron/oauthJwk';
import { sendApiKeyCreatedEmailQueueProcessor } from './queues/created/sendApiKeyCreatedEmail';
import { sendApiKeyCreatedEmailToMemberQueueProcessor } from './queues/created/sendApiKeyCreatedEmailToMember';
import { notifyExpiredApiKeyAdminsQueueProcessor } from './queues/expired/notifyExpiredApiKeyAdmins';
import { sendExpiredApiKeyEmailQueueProcessor } from './queues/expired/sendExpiredApiKeyEmail';
import { syncCliAuthScopesQueueProcessor } from './queues/syncCliAuthScopes';

export * from './lib/apiKeyIpFilters';
export { startCliAuthScopesSync } from './queues/syncCliAuthScopes';
export * from './services';

export let machineAccessQueueProcessor = combineQueueProcessors([
  expiresApiKeysProcessors,
  sendApiKeyCreatedEmailQueueProcessor,
  sendApiKeyCreatedEmailToMemberQueueProcessor,
  notifyExpiredApiKeyAdminsQueueProcessor,
  sendExpiredApiKeyEmailQueueProcessor,
  syncCliAuthScopesQueueProcessor,
  cleanupCron,
  oauthJwkRotationCron
]);
