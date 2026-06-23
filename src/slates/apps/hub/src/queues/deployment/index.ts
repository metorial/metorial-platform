import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  deploySlateVersionCompletedQueueProcessor,
  deploySlateVersionFailedQueueProcessor,
  deploySlateVersionMonitorQueueProcessor,
  deploySlateVersionProviderCompletedQueueProcessor,
  deploySlateVersionQueueProcessor,
  deploySlateVersionStartQueueProcessor,
  failOldDeploymentsCron
} from './deploy';

export let deploymentQueues = combineQueueProcessors([
  deploySlateVersionQueueProcessor,
  deploySlateVersionStartQueueProcessor,
  deploySlateVersionMonitorQueueProcessor,
  deploySlateVersionProviderCompletedQueueProcessor,
  deploySlateVersionCompletedQueueProcessor,
  deploySlateVersionFailedQueueProcessor,
  failOldDeploymentsCron
]);
