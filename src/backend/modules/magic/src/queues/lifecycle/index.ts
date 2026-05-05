import { combineQueueProcessors } from '@metorial/queue';
import {
  magicMcpEndpointCreatedQueueProcessor,
  magicMcpEndpointDeletedQueueProcessor,
  magicMcpEndpointUpdatedQueueProcessor
} from './magicMcpEndpoint';
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

export * from './magicMcpEndpoint';
export * from './magicMcpGroup';
export * from './magicMcpServer';

export let magicLifecycleQueueProcessor = combineQueueProcessors([
  magicMcpEndpointCreatedQueueProcessor,
  magicMcpEndpointUpdatedQueueProcessor,
  magicMcpEndpointDeletedQueueProcessor,
  magicMcpGroupCreatedQueueProcessor,
  magicMcpGroupUpdatedQueueProcessor,
  magicMcpGroupDeletedQueueProcessor,
  magicMcpServerCreatedQueueProcessor,
  magicMcpServerUpdatedQueueProcessor,
  magicMcpServerDeletedQueueProcessor
]);
