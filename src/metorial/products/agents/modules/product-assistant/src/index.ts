import { combineQueueProcessors } from '@metorial/queue';
import { generateAssistantConversationTitleQueueProcessor } from './queues/generateConversationTitle';
import { processAssistantRequestQueueProcessor } from './queues/processRequest';
import { subspaceIntegrationCleanupProcessor } from './queues/subspaceIntegrationCleanup';

export * from './services';
export * from './types';
export { assistants } from './definitions/assistants';
export { getAssistantDefinition } from './lib/definitions/assistantDefinition';
export { listenToAssistantRunDeltas } from './lib/run/redisDeltas';
export type { AgentRunWireMessage } from './lib/run/state';
export { generateAssistantConversationTitleQueue } from './queues/generateConversationTitle';
export { processAssistantRequestQueue } from './queues/processRequest';

export let productAssistantQueueProcessor = combineQueueProcessors([
  generateAssistantConversationTitleQueueProcessor,
  processAssistantRequestQueueProcessor,
  subspaceIntegrationCleanupProcessor
]);
