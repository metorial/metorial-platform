import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { lifecycleQueues } from './queues/lifecycle';
import { reconcileQueues } from './queues/reconcile';
import { searchQueues } from './queues/search';

export let deploymentQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  reconcileQueues,
  searchQueues,
  deleteQueues
]);
