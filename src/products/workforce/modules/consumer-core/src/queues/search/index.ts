import { combineQueueProcessors } from '@metorial/queue';
import { indexConsumerSearchQueueProcessor } from './consumer';
import { indexConsumerGroupSearchQueueProcessor } from './consumerGroup';

export * from './consumer';
export * from './consumerGroup';

export let consumerCoreSearchQueueProcessor = combineQueueProcessors([
  indexConsumerSearchQueueProcessor,
  indexConsumerGroupSearchQueueProcessor
]);
