import { combineQueueProcessors } from '@metorial/queue';
import { cleanupCron } from './cron/cleanup';
import { setCustomServerListingQueueProcessor } from './queues/customListing';
import { rankProcessors } from './queues/rank';
import { indexServerListingQueueProcessor } from './queues/search';
import { manuallyTriggerCatalogSync, syncProcessors } from './queues/sync';

export * from './services';

export { manuallyTriggerCatalogSync };

export let catalogQueueProcessor = combineQueueProcessors([
  syncProcessors,
  rankProcessors,
  setCustomServerListingQueueProcessor,
  indexServerListingQueueProcessor,
  cleanupCron
]);
