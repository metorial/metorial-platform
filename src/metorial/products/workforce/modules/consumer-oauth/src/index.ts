import { combineQueueProcessors } from '@metorial/queue';
import { reconcileConsumerAuthClientExpirationCron } from './cron/reconcileConsumerAuthClientExpiration';

export * from './services';

export let consumerOAuthQueueProcessor = combineQueueProcessors([
  reconcileConsumerAuthClientExpirationCron
]);
