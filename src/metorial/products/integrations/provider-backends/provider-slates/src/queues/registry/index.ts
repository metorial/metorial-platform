import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  syncCollectionsCron,
  syncCollectionsManyProcessor,
  syncCollectionsRegProcessor,
  syncCollectionsSingleProcessor
} from './syncCollections';

export let registryQueues = combineQueueProcessors([
  syncCollectionsCron,
  syncCollectionsRegProcessor,
  syncCollectionsManyProcessor,
  syncCollectionsSingleProcessor
]);
