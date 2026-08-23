import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexProviderListingQueueProcessor } from './providerListing';
import { indexPublisherQueueProcessor } from './publisher';

export let searchQueues = combineQueueProcessors([
  indexProviderListingQueueProcessor,
  indexPublisherQueueProcessor
]);
