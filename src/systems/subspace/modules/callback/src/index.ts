import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { reconcilerQueueProcessor } from './reconciler';

export * from './lib/callbackInstanceEnrichment';
export * from './services';

export let callbackQueueProcessor = combineQueueProcessors([
  reconcilerQueueProcessor,
  deleteQueues
]);
