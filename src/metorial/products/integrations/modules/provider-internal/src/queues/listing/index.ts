import { combineQueueProcessors } from '@lowerdeck/queue';
import { rankProcessors } from './rank';
import { indexProviderListingQueueProcessor } from './search';

export let listingQueues = combineQueueProcessors([
  rankProcessors,
  indexProviderListingQueueProcessor
]);
