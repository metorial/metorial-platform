import { combineQueueProcessors } from '@lowerdeck/queue';
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
