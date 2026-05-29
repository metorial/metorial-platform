import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { ingressNetworkLogProcessors } from './queues/networkLog/ingress';
import { reconcileProviderDeploymentEnclaveProcessors } from './queues/reconcile/providerDeploymentEnclave';

export let enclaveQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  ingressNetworkLogProcessors,
  reconcileProviderDeploymentEnclaveProcessors
]);
