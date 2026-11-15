import { combineQueueProcessors } from '@metorial/queue';
import { indexEventDestinationQueueProcessor } from './eventDestination';
import { reindexEventDestinationsManyQueueProcessor } from './reindex';

export { indexEventDestinationQueue } from './eventDestination';
export { startFullEventDestinationReindex } from './reindex';

export let eventDestinationSearchQueueProcessor = combineQueueProcessors([
  indexEventDestinationQueueProcessor,
  reindexEventDestinationsManyQueueProcessor
]);
