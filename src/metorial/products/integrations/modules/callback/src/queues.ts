import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { callbackEventProcessQueueProcessor } from './queues/processEvent';

export let callbackQueueProcessor = combineQueueProcessors([
  callbackEventProcessQueueProcessor,
  deleteQueues
]);
