import { twoFactorCleanupProcessor } from './cron/twoFactorCleanup';
import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';
import { relayEmailQueueProcessor } from './email/client';
import { disableSsoDirectoryUsersProcessor } from './queues/disableSsoDirectoryUsers';
import { reconcileAccountUsersProcessor } from './queues/reconcileAccountUsers';
import { recordSsoUserChangesProcessor } from './queues/recordSsoUserChanges';
import { reconcileSsoGroupRoleMembershipsProcessor } from './queues/reconcileSsoGroupRoleMemberships';
import { reconcileSsoUsersProcessor } from './queues/reconcileSsoUsers';
import { syncCallbackQueueProcessor } from './queues/syncCallback';
import { syncImportedDelegationsProcessor } from './queues/syncImportedDelegations';

await runQueueProcessors([
  twoFactorCleanupProcessor,
  cleanupCron,
  relayEmailQueueProcessor,
  disableSsoDirectoryUsersProcessor,
  reconcileAccountUsersProcessor,
  recordSsoUserChangesProcessor,
  reconcileSsoGroupRoleMembershipsProcessor,
  reconcileSsoUsersProcessor,
  syncCallbackQueueProcessor,
  syncImportedDelegationsProcessor
]);
