import { combineQueueProcessors } from '@metorial/queue';
import { eventDestinationSearchQueueProcessor } from './search';

export { indexEventDestinationQueue } from './search';

export let eventDestinationQueueProcessor = combineQueueProcessors([
  eventDestinationSearchQueueProcessor
]);
