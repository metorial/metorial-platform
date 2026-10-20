import { combineQueueProcessors } from '@metorial/queue';
import { reconcileConsumerAuthClientExpirationCron } from './cron/reconcileConsumerAuthClientExpiration';
import { reconcileConsumerClientLogosProcessors } from './queues/reconcileConsumerClientLogos';

export * from './services';

export let consumerOAuthQueueProcessor = combineQueueProcessors([
  reconcileConsumerAuthClientExpirationCron,
  reconcileConsumerClientLogosProcessors
]);
