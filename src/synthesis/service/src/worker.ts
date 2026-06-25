import { runQueueProcessors } from '@lowerdeck/queue';
import { generateAssistantConversationTitleQueueProcessor } from './queues/generateConversationTitle';
import { processAssistantRequestQueueProcessor } from './queues/processRequest';
import { subspaceIntegrationCleanupProcessor } from './queues/subspaceIntegrationCleanup';

async function main() {
  await runQueueProcessors([
    generateAssistantConversationTitleQueueProcessor,
    processAssistantRequestQueueProcessor,
    subspaceIntegrationCleanupProcessor
  ]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
