import { combineQueueProcessors } from '@lowerdeck/queue';
import { reconcileAccountUsersProcessor } from './queues/reconcileAccountUsers';
import { accountCleanupCron } from './cron/cleanup';

export * from './lib/accountPolicy';
export * from './queues/reconcileAccountUsers';
export * from './services/account';
export * from './services/domainPolicy';

export let accountQueueProcessor = combineQueueProcessors([
  reconcileAccountUsersProcessor,
  accountCleanupCron
]);
