import { combineQueueProcessors } from '@metorial/queue';
import { generateAssistantConversationTitleQueueProcessor } from './queues/generateConversationTitle';
import { processAssistantRequestQueueProcessor } from './queues/processRequest';

export * from './services';

export let assistantQueueProcessor = combineQueueProcessors([
  generateAssistantConversationTitleQueueProcessor,
  processAssistantRequestQueueProcessor
]);
