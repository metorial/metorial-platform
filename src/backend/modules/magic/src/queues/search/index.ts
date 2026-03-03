import { combineQueueProcessors } from '@metorial/queue';
import { indexMagicMcpGroupSearchQueueProcessor } from './magicMcpGroup';
import { indexMagicMcpServerSearchQueueProcessor } from './magicMcpServer';

export * from './magicMcpGroup';
export * from './magicMcpServer';

export let magicSearchQueueProcessor = combineQueueProcessors([
  indexMagicMcpGroupSearchQueueProcessor,
  indexMagicMcpServerSearchQueueProcessor
]);
