import { combineQueueProcessors } from '@lowerdeck/queue';
import { deleteQueues } from './queues/delete';
import { lifecycleFederationQueues, lifecycleSubspaceQueues } from './queues/lifecycle';
import { ownerActorQueues } from './queues/ownerActor';
import { searchQueues } from './queues/search';

export let integrationSubspaceQueueProcessor = combineQueueProcessors([
  lifecycleSubspaceQueues
]);

export let integrationFederationQueueProcessor = combineQueueProcessors([
  lifecycleFederationQueues,
  searchQueues,
  deleteQueues,
  ownerActorQueues
]);

export let integrationQueueProcessor = combineQueueProcessors([
  integrationSubspaceQueueProcessor,
  integrationFederationQueueProcessor
]);
