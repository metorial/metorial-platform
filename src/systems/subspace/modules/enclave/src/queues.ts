import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { reconcileProviderDeploymentEnclaveProcessors } from './queues/reconcile/providerDeploymentEnclave';

export let enclaveQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  reconcileProviderDeploymentEnclaveProcessors
]);
