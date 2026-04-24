import { combineQueueProcessors } from '@metorial/queue';
import {
  magicMcpEndpointCreatedQueueProcessor,
  magicMcpEndpointDeletedQueueProcessor,
  magicMcpEndpointDeletedSubspaceSessionQueueProcessor,
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
  magicMcpServerDeletedSubspaceSessionQueueProcessor,
  magicMcpServerUpdatedQueueProcessor
} from './magicMcpServer';

export * from './magicMcpEndpoint';
export * from './magicMcpGroup';
export * from './magicMcpServer';

export let magicLifecycleQueueProcessor = combineQueueProcessors([
  magicMcpEndpointCreatedQueueProcessor,
  magicMcpEndpointUpdatedQueueProcessor,
  magicMcpEndpointDeletedQueueProcessor,
  magicMcpEndpointDeletedSubspaceSessionQueueProcessor,
  magicMcpGroupCreatedQueueProcessor,
  magicMcpGroupUpdatedQueueProcessor,
  magicMcpGroupDeletedQueueProcessor,
  magicMcpServerCreatedQueueProcessor,
  magicMcpServerUpdatedQueueProcessor,
  magicMcpServerDeletedQueueProcessor,
  magicMcpServerDeletedSubspaceSessionQueueProcessor
]);
