import { combineQueueProcessors } from '@lowerdeck/queue';
import { providerDeploymentConfigPairSetSpecificationQueueProcessor } from './setSpec';
import { providerDeploymentConfigPairSyncSpecificationQueueProcessor } from './syncSpec';

export let deploymentConfigPairQueues = combineQueueProcessors([
  providerDeploymentConfigPairSyncSpecificationQueueProcessor,
  providerDeploymentConfigPairSetSpecificationQueueProcessor
]);
