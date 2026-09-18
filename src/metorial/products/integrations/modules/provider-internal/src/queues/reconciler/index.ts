import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  deprecateDockerProviderManyQueueProcessor,
  deprecateDockerProviderSingleQueueProcessor
} from './deprecateProvider';

export { startDockerProviderDeprecation } from './deprecateProvider';

export let reconcilerQueues = combineQueueProcessors([
  deprecateDockerProviderManyQueueProcessor,
  deprecateDockerProviderSingleQueueProcessor
]);
