import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';
import { reconcileSsoGroupRoleMembershipsProcessor } from './queues/reconcileSsoGroupRoleMemberships';
import { reconcileSsoUsersProcessor } from './queues/reconcileSsoUsers';

await runQueueProcessors([
  cleanupCron,
  reconcileSsoGroupRoleMembershipsProcessor,
  reconcileSsoUsersProcessor
]);
