import { combineQueueProcessors } from '@lowerdeck/queue';
import { applyDiscoveredImageQueueProcessor } from './applyDiscoveredImage';
import { rankProcessors } from './rank';
import { indexProviderListingQueueProcessor } from './search';

export let listingQueues = combineQueueProcessors([
  rankProcessors,
  applyDiscoveredImageQueueProcessor,
  indexProviderListingQueueProcessor
]);
