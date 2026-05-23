import { combineQueueProcessors } from '@mtsrc/queue';
import { deleteQueues } from './queues/delete';
import { reconcilerQueueProcessor } from './reconciler';

export let callbackQueueProcessor = combineQueueProcessors([
  reconcilerQueueProcessor,
  deleteQueues
]);
