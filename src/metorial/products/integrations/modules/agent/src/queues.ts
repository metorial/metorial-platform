import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { mirrorQueues } from './queues/mirror';
import { searchQueues } from './queues/search';

export let agentSubspaceQueueProcessor = combineQueueProcessors([lifecycleQueues]);

export let agentFederationQueueProcessor = combineQueueProcessors([
  mirrorQueues,
  searchQueues
]);

export let agentQueueProcessor = combineQueueProcessors([
  agentSubspaceQueueProcessor,
  agentFederationQueueProcessor
]);
