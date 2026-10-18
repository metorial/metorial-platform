import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { lifecycleFederationQueues, lifecycleSubspaceQueues } from './queues/lifecycle';
import { reconcileQueues } from './queues/reconcile';
import { searchQueues } from './queues/search';

export let deploymentSubspaceQueueProcessor = combineQueueProcessors([
  lifecycleSubspaceQueues
]);

export let deploymentFederationQueueProcessor = combineQueueProcessors([
  lifecycleFederationQueues,
  reconcileQueues,
  searchQueues,
  deleteQueues
]);

export let deploymentQueueProcessor = combineQueueProcessors([
  deploymentSubspaceQueueProcessor,
  deploymentFederationQueueProcessor
]);
