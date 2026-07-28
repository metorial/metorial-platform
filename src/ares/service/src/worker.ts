import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';
import { disableSsoDirectoryUsersProcessor } from './queues/disableSsoDirectoryUsers';
import { reconcileAccountUsersProcessor } from './queues/reconcileAccountUsers';
import { recordSsoUserChangesProcessor } from './queues/recordSsoUserChanges';
import { reconcileSsoGroupRoleMembershipsProcessor } from './queues/reconcileSsoGroupRoleMemberships';
import { reconcileSsoUsersProcessor } from './queues/reconcileSsoUsers';
import { syncImportedDelegationsProcessor } from './queues/syncImportedDelegations';
import { userSyncCallbackQueueProcessor } from './queues/userSyncCallback';

await runQueueProcessors([
  cleanupCron,
  disableSsoDirectoryUsersProcessor,
  reconcileAccountUsersProcessor,
  recordSsoUserChangesProcessor,
  reconcileSsoGroupRoleMembershipsProcessor,
  reconcileSsoUsersProcessor,
  syncImportedDelegationsProcessor,
  userSyncCallbackQueueProcessor
]);
