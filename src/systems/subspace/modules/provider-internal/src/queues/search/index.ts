import { combineQueueProcessors } from '@mtsrc/queue';
import { indexProviderListingQueueProcessor } from './providerListing';
import { indexPublisherQueueProcessor } from './publisher';

export let searchQueues = combineQueueProcessors([
  indexProviderListingQueueProcessor,
  indexPublisherQueueProcessor
]);
