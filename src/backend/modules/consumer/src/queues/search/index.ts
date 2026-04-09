import { combineQueueProcessors } from '@metorial/queue';
import { indexConsumerAccessRequestSearchQueueProcessor } from './consumerAccessRequest';
import { indexConsumerSearchQueueProcessor } from './consumer';
import { indexConsumerGroupSearchQueueProcessor } from './consumerGroup';
import { indexProviderTemplateSearchQueueProcessor } from './providerTemplate';

export * from './consumerAccessRequest';
export * from './consumer';
export * from './consumerGroup';
export * from './providerTemplate';

export let consumerSearchQueueProcessor = combineQueueProcessors([
  indexConsumerAccessRequestSearchQueueProcessor,
  indexConsumerSearchQueueProcessor,
  indexConsumerGroupSearchQueueProcessor,
  indexProviderTemplateSearchQueueProcessor
]);
