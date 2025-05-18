import { combineQueueProcessors } from '@metorial/queue';
import { indexServerListingQueueProcessor } from './queues';
import { rankProcessors } from './queues/rank';
import { syncProcessors } from './queues/sync';

export * from './services';

export let catalogQueueProcessor = combineQueueProcessors([
  syncProcessors,
  rankProcessors,
  indexServerListingQueueProcessor
]);
