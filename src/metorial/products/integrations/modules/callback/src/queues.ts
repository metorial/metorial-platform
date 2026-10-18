import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { callbackEventProcessQueueProcessor } from './queues/processEvent';
import { pushQueues } from './queues/push';
import { reconcileFederationQueues, reconcileSubspaceQueues } from './queues/reconcile';
import { searchQueues } from './queues/search';

export let callbackSubspaceQueueProcessor = combineQueueProcessors([
  callbackEventProcessQueueProcessor,
  pushQueues,
  reconcileSubspaceQueues
]);

export let callbackFederationQueueProcessor = combineQueueProcessors([
  reconcileFederationQueues,
  deleteQueues,
  searchQueues
]);

export let callbackQueueProcessor = combineQueueProcessors([
  callbackSubspaceQueueProcessor,
  callbackFederationQueueProcessor
]);
