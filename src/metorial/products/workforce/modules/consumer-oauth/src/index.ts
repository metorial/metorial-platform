import { combineQueueProcessors } from '@metorial/queue';
import { reconcileConsumerClientLogosProcessors } from './queues/reconcileConsumerClientLogos';

export * from './services';

export let consumerOAuthQueueProcessor = combineQueueProcessors([
  reconcileConsumerClientLogosProcessors
]);
