import { combineQueueProcessors } from '@metorial/queue';
import { indexEventDestinationQueueProcessor } from './eventDestination';
import {
  reindexEventDestinationsCron,
  reindexEventDestinationsManyQueueProcessor
} from './reindex';

export { indexEventDestinationQueue } from './eventDestination';

export let eventDestinationSearchQueueProcessor = combineQueueProcessors([
  indexEventDestinationQueueProcessor,
  reindexEventDestinationsCron,
  reindexEventDestinationsManyQueueProcessor
]);
