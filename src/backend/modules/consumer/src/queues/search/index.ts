import { combineQueueProcessors } from '@metorial/queue';
import { indexConsumerSearchQueueProcessor } from './consumer';
import { indexConsumerAccessRequestSearchQueueProcessor } from './consumerAccessRequest';
import { indexConsumerGroupSearchQueueProcessor } from './consumerGroup';
import { indexProviderTemplateSearchQueueProcessor } from './providerTemplate';

export * from './consumer';
export * from './consumerAccessRequest';
export * from './consumerGroup';
export * from './providerTemplate';

export let consumerSearchQueueProcessor = combineQueueProcessors([
  indexConsumerAccessRequestSearchQueueProcessor,
  indexConsumerSearchQueueProcessor,
  indexConsumerGroupSearchQueueProcessor,
  indexProviderTemplateSearchQueueProcessor
]);
