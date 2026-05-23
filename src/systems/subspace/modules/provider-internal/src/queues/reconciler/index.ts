import { combineQueueProcessors } from '@mtsrc/queue';
import {
  deprecateDockerProviderManyQueueProcessor,
  deprecateDockerProviderReconcilerCron,
  deprecateDockerProviderSingleQueueProcessor
} from './deprecateProvider';

export let reconcilerQueues = combineQueueProcessors([
  deprecateDockerProviderReconcilerCron,
  deprecateDockerProviderManyQueueProcessor,
  deprecateDockerProviderSingleQueueProcessor
]);
