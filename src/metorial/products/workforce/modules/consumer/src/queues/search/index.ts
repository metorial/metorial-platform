import { combineQueueProcessors } from '@metorial/queue';
import { indexConsumerSearchQueueProcessor } from './consumer';
import { indexConsumerAccessRequestSearchQueueProcessor } from './consumerAccessRequest';
import { indexConsumerGroupSearchQueueProcessor } from './consumerGroup';

export * from './consumer';
export * from './consumerAccessRequest';
export * from './consumerGroup';

export let consumerSearchQueueProcessor = combineQueueProcessors([
  indexConsumerAccessRequestSearchQueueProcessor,
  indexConsumerSearchQueueProcessor,
  indexConsumerGroupSearchQueueProcessor
]);
