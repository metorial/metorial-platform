import { combineQueueProcessors } from '@lowerdeck/queue';
import { retentionQueues } from './queues/retention';
import { cleanupProcessors } from './queues/cron/cleanup';

export let retentionQueueProcessor = combineQueueProcessors([
  cleanupProcessors,
  retentionQueues
]);
