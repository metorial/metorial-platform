import { combineQueueProcessors } from '@mtsrc/queue';
import {
  syncCollectionsCron,
  syncCollectionsManyProcessor,
  syncCollectionsRegProcessor,
  syncCollectionsSingleProcessor
} from './syncCollections';
import { syncRegistriesCron } from './syncRegistries';

export let registryQueues = combineQueueProcessors([
  syncRegistriesCron,

  syncCollectionsCron,
  syncCollectionsRegProcessor,
  syncCollectionsManyProcessor,
  syncCollectionsSingleProcessor
]);
