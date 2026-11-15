import { combineQueueProcessors } from '@metorial/queue';
import { attemptDeliveryQueueProcessor } from './attempt';
import { eventDeliveryAttemptFlushProcessors } from './attemptDetailFlush';
import { eventDeliveryDispatchQueueProcessor } from './dispatch';

export { attemptDeliveryQueue } from './attempt';
export { dispatchSystemEventDelivery, eventDeliveryDispatchQueue } from './dispatch';

export let eventDeliveryQueueProcessor = combineQueueProcessors([
  eventDeliveryDispatchQueueProcessor,
  attemptDeliveryQueueProcessor,
  eventDeliveryAttemptFlushProcessors
]);
