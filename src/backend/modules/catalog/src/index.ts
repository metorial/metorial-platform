import { combineQueueProcessors } from '@metorial/queue';
import { setCustomServerListingQueueProcessor } from './queues/customListing';
import { rankProcessors } from './queues/rank';
import { indexServerListingQueueProcessor } from './queues/search';
import { syncProcessors } from './queues/sync';

export * from './services';

export let catalogQueueProcessor = combineQueueProcessors([
  syncProcessors,
  rankProcessors,
  setCustomServerListingQueueProcessor,
  indexServerListingQueueProcessor
]);
