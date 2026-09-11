import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexChatIntegrationQueueProcessor } from './chatIntegration';
import { indexChatIntegrationInstanceQueueProcessor } from './chatIntegrationInstance';

export let searchQueues = combineQueueProcessors([
  indexChatIntegrationQueueProcessor,
  indexChatIntegrationInstanceQueueProcessor
]);
