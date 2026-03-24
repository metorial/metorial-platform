import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  customProviderCreatedQueueProcessor,
  customProviderUpdatedQueueProcessor
} from './customProvider';
import { customProviderDeploymentCreatedQueueProcessor } from './customProviderDeployment';

export let lifecycleQueues = combineQueueProcessors([
  customProviderCreatedQueueProcessor,
  customProviderUpdatedQueueProcessor,

  customProviderDeploymentCreatedQueueProcessor
]);
