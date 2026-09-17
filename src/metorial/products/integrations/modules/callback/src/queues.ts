import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { callbackEventProcessQueueProcessor } from './queues/processEvent';
import { pushQueues } from './queues/push';
import { reconcileQueues } from './queues/reconcile';
import { searchQueues } from './queues/search';

export let callbackQueueProcessor = combineQueueProcessors([
  callbackEventProcessQueueProcessor,
  reconcileQueues,
  pushQueues,
  deleteQueues,
  searchQueues
]);
