import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { ingressNetworkLogProcessors } from './queues/networkLog/ingress';
import { reconcileEnclaveInstanceConfigurationProcessors } from './queues/reconcile/enclaveInstanceConfiguration';
import { reconcileProviderDeploymentEnclaveProcessors } from './queues/reconcile/providerDeploymentEnclave';

export let enclaveSubspaceQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  reconcileProviderDeploymentEnclaveProcessors,
  reconcileEnclaveInstanceConfigurationProcessors
]);

export let enclaveFederationQueueProcessor = combineQueueProcessors([
  ingressNetworkLogProcessors
]);

export let enclaveQueueProcessor = combineQueueProcessors([
  enclaveSubspaceQueueProcessor,
  enclaveFederationQueueProcessor
]);
