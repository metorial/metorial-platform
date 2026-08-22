import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { reconcilerQueueProcessor } from './reconciler';
import { callbackConfigBackingDeleteQueueProcessor } from './queues/deleteCallbackConfigBacking';
import {
  callbackFanoutQueueProcessor,
  callbackIntegrationReconcileQueueProcessor,
  callbackProviderReconcileQueueProcessor
} from './queues/integrationReconcile';

export let callbackQueueProcessor = combineQueueProcessors([
  reconcilerQueueProcessor,
  deleteQueues,
  callbackConfigBackingDeleteQueueProcessor,
  callbackIntegrationReconcileQueueProcessor,
  callbackFanoutQueueProcessor,
  callbackProviderReconcileQueueProcessor
]);

export { callbackConfigBackingDeleteQueue } from './queues/deleteCallbackConfigBacking';
export {
  callbackFanoutQueue,
  callbackIntegrationReconcileQueue,
  callbackProviderReconcileQueue
} from './queues/integrationReconcile';
