import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';
import { disableSsoDirectoryUsersProcessor } from './queues/disableSsoDirectoryUsers';
import { recordSsoUserChangesProcessor } from './queues/recordSsoUserChanges';
import { reconcileSsoGroupRoleMembershipsProcessor } from './queues/reconcileSsoGroupRoleMemberships';
import { reconcileSsoUsersProcessor } from './queues/reconcileSsoUsers';

await runQueueProcessors([
  cleanupCron,
  disableSsoDirectoryUsersProcessor,
  recordSsoUserChangesProcessor,
  reconcileSsoGroupRoleMembershipsProcessor,
  reconcileSsoUsersProcessor
]);
