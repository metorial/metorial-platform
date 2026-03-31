import { combineQueueProcessors } from '@metorial/queue';
import {
  reconcileConsumerActorQueueProcessor,
  syncIdentityConsumerQueueProcessor
} from './queues/syncIdentityConsumer';

export * from './services';

export let consumerQueueProcessor = combineQueueProcessors([
  syncIdentityConsumerQueueProcessor,
  reconcileConsumerActorQueueProcessor
]);
