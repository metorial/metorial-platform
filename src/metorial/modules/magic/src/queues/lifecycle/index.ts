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
import { magicMcpBackingCleanupQueueProcessor } from './magicMcpBackingCleanup';
import {
  providerTemplateArchivedQueueProcessor,
  providerTemplateCreatedQueueProcessor,
  providerTemplateUpdatedQueueProcessor
} from './providerTemplate';

export * from './magicMcpEndpoint';
export * from './magicMcpGroup';
export * from './magicMcpServer';
export * from './magicMcpBackingCleanup';
export * from './providerTemplate';

export let magicLifecycleQueueProcessor = combineQueueProcessors([
  magicMcpEndpointCreatedQueueProcessor,
  magicMcpEndpointUpdatedQueueProcessor,
  magicMcpEndpointDeletedQueueProcessor,
  magicMcpGroupCreatedQueueProcessor,
  magicMcpGroupUpdatedQueueProcessor,
  magicMcpGroupDeletedQueueProcessor,
  magicMcpServerCreatedQueueProcessor,
  magicMcpServerUpdatedQueueProcessor,
  magicMcpServerDeletedQueueProcessor,
  magicMcpBackingCleanupQueueProcessor,
  providerTemplateCreatedQueueProcessor,
  providerTemplateUpdatedQueueProcessor,
  providerTemplateArchivedQueueProcessor
]);
