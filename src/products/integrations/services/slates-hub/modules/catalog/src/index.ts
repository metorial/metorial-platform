import { combineQueueProcessors } from '@lowerdeck/queue';
import { deploymentQueues } from './queues/deployment';
import { discoveryQueues } from './queues/discovery';
import { registryQueues } from './queues/registry';

export let catalogQueueProcessor = combineQueueProcessors([
  registryQueues,
  deploymentQueues,
  discoveryQueues
]);
