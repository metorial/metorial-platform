import { combineQueueProcessors } from '@lowerdeck/queue';
import { archiveQueues } from './queues/archive';
import { deleteQueues } from './queues/delete';
import { expireQueues } from './queues/expire';
import { lifecycleFederationQueues, lifecycleSubspaceQueues } from './queues/lifecycle';
import { mirrorQueues } from './queues/mirror';
import { reconcileQueues } from './queues/reconciler';
import { searchQueues } from './queues/search';

export let identitySubspaceQueueProcessor = combineQueueProcessors([
  lifecycleSubspaceQueues,
  reconcileQueues,
  expireQueues
]);

export let identityFederationQueueProcessor = combineQueueProcessors([
  lifecycleFederationQueues,
  searchQueues,
  deleteQueues,
  archiveQueues,
  mirrorQueues
]);

export let identityQueueProcessor = combineQueueProcessors([
  identitySubspaceQueueProcessor,
  identityFederationQueueProcessor
]);
