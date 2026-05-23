import { runQueueProcessors } from '@mtsrc/queue';
import { generateAssistantConversationTitleQueueProcessor } from './queues/generateConversationTitle';
import { processAssistantRequestQueueProcessor } from './queues/processRequest';

async function main() {
  await runQueueProcessors([
    generateAssistantConversationTitleQueueProcessor,
    processAssistantRequestQueueProcessor
  ]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
