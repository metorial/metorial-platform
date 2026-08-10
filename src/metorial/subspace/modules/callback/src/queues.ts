import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { reconcilerQueueProcessor } from './reconciler';

export let callbackQueueProcessor = combineQueueProcessors([
  reconcilerQueueProcessor,
  deleteQueues
]);
