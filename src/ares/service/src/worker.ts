import { runQueueProcessors } from '@lowerdeck/queue';
import { cleanupCron } from './cron/cleanup';
import { reconcileSsoGroupRoleMembershipsProcessor } from './queues/reconcileSsoGroupRoleMemberships';

await runQueueProcessors([cleanupCron, reconcileSsoGroupRoleMembershipsProcessor]);
