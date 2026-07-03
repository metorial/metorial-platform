import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';
import { recordSsoUserChangesProcessor } from './queues/recordSsoUserChanges';
import { reconcileSsoGroupRoleMembershipsProcessor } from './queues/reconcileSsoGroupRoleMemberships';
import { reconcileSsoUsersProcessor } from './queues/reconcileSsoUsers';

await runQueueProcessors([
  cleanupCron,
  recordSsoUserChangesProcessor,
  reconcileSsoGroupRoleMembershipsProcessor,
  reconcileSsoUsersProcessor
]);
