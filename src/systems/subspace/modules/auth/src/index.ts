import { combineQueueProcessors } from '@lowerdeck/queue';
import { cronQueues } from './queues/cron';
import { deleteQueues } from './queues/delete';
import { lifecycleQueues } from './queues/lifecycle';
import { reconcileQueues } from './queues/reconcile';
import { searchQueues } from './queues/search';

export * from './services';
export * from './queues/reconcile';

export let authQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  cronQueues,
  deleteQueues,
  reconcileQueues
]);
