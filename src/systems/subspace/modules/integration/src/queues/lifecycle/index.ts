import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  integrationArchivedQueueProcessor,
  integrationArchiveProvidersManyQueueProcessor,
  integrationCreatedQueueProcessor,
  integrationDeletedQueueProcessor,
  integrationUpdatedQueueProcessor
} from './integration';
import {
  integrationProviderArchivedQueueProcessor,
  integrationProviderCreatedQueueProcessor,
  integrationProviderUpdatedQueueProcessor
} from './integrationProvider';

export let lifecycleQueues = combineQueueProcessors([
  integrationCreatedQueueProcessor,
  integrationUpdatedQueueProcessor,
  integrationArchivedQueueProcessor,
  integrationArchiveProvidersManyQueueProcessor,
  integrationDeletedQueueProcessor,
  integrationProviderCreatedQueueProcessor,
  integrationProviderUpdatedQueueProcessor,
  integrationProviderArchivedQueueProcessor
]);
