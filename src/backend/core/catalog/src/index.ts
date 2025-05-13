import { combineQueueProcessors } from '@metorial/queue';
import { indexServerListingQueueProcessor } from './queues';
import { syncProcessors } from './queues/sync';

export * from './services';

export let catalogQueueProcessor = combineQueueProcessors([
  syncProcessors,
  indexServerListingQueueProcessor
]);
