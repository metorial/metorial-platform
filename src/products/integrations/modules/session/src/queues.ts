import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { lifecycleFederationQueues, lifecycleSubspaceQueues } from './queues/lifecycle';

export let sessionSubspaceQueueProcessor = combineQueueProcessors([lifecycleSubspaceQueues]);

export let sessionFederationQueueProcessor = combineQueueProcessors([
  lifecycleFederationQueues,
  deleteQueues
]);

export let sessionQueueProcessor = combineQueueProcessors([
  sessionSubspaceQueueProcessor,
  sessionFederationQueueProcessor
]);
