import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { ingressNetworkLogProcessors } from './queues/networkLog/ingress';
import { reconcileEnclaveInstanceConfigurationProcessors } from './queues/reconcile/enclaveInstanceConfiguration';
import { reconcileProviderDeploymentEnclaveProcessors } from './queues/reconcile/providerDeploymentEnclave';

export let enclaveQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  ingressNetworkLogProcessors,
  reconcileProviderDeploymentEnclaveProcessors,
  reconcileEnclaveInstanceConfigurationProcessors
]);
