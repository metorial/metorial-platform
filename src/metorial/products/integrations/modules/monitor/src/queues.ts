import { combineQueueProcessors } from '@lowerdeck/queue';
import { reconcileQueues } from './queues/reconcile';
import { schemaChangeQueueProcessors } from './queues/schemaChange';

export let monitorQueueProcessor = combineQueueProcessors([
  reconcileQueues,
  schemaChangeQueueProcessors
]);
