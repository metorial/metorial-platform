import { combineQueueProcessors } from '@lowerdeck/queue';
import { instanceQueues } from './queues/instance';
import { reconcileEventIdsQueue } from './queues/instance/reconcileEventIds';

export let instanceQueueProcessor = combineQueueProcessors([instanceQueues]);

export let enqueueInstanceReconciliation = async () => {
  await reconcileEventIdsQueue.add({});
};
