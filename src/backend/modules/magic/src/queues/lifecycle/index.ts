import { combineQueueProcessors } from '@metorial/queue';
import {
  magicMcpGroupCreatedQueueProcessor,
  magicMcpGroupDeletedQueueProcessor,
  magicMcpGroupUpdatedQueueProcessor
} from './magicMcpGroup';
import {
  magicMcpServerCreatedQueueProcessor,
  magicMcpServerDeletedQueueProcessor,
  magicMcpServerUpdatedQueueProcessor
} from './magicMcpServer';

export * from './magicMcpGroup';
export * from './magicMcpServer';

export let magicLifecycleQueueProcessor = combineQueueProcessors([
  magicMcpGroupCreatedQueueProcessor,
  magicMcpGroupUpdatedQueueProcessor,
  magicMcpGroupDeletedQueueProcessor,
  magicMcpServerCreatedQueueProcessor,
  magicMcpServerUpdatedQueueProcessor,
  magicMcpServerDeletedQueueProcessor
]);
