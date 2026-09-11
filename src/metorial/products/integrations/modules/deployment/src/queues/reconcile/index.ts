import { combineQueueProcessors } from '@lowerdeck/queue';
import { reconcileProviderDeploymentMonitorProcessors } from './providerDeploymentMonitor';

export let reconcileQueues = combineQueueProcessors([
  reconcileProviderDeploymentMonitorProcessors
]);
