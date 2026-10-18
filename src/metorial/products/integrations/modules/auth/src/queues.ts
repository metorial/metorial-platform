import { combineQueueProcessors } from '@lowerdeck/queue';
import { cronFederationQueues, cronSubspaceQueues } from './queues/cron';
import { deleteQueues } from './queues/delete';
import { lifecycleFederationQueues, lifecycleSubspaceQueues } from './queues/lifecycle';
import { reconcileQueues } from './queues/reconcile';
import { searchQueues } from './queues/search';

export * from './queues/reconcile';

export let authSubspaceQueueProcessor = combineQueueProcessors([
  lifecycleSubspaceQueues,
  cronSubspaceQueues
]);

export let authFederationQueueProcessor = combineQueueProcessors([
  lifecycleFederationQueues,
  cronFederationQueues,
  searchQueues,
  deleteQueues,
  reconcileQueues
]);

export let authQueueProcessor = combineQueueProcessors([
  authSubspaceQueueProcessor,
  authFederationQueueProcessor
]);
