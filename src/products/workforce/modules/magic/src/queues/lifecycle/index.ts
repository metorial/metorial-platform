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
import {
  magicMcpBackingCleanupBackingsManyQueueProcessor,
  magicMcpBackingCleanupIntegrationInstancesManyQueueProcessor,
  magicMcpBackingCleanupManyQueueProcessor,
  magicMcpBackingCleanupProviderTemplateQueueProcessor,
  magicMcpBackingCleanupProviderTemplatesManyQueueProcessor,
  magicMcpBackingCleanupServerQueueProcessor
} from './magicMcpBackingCleanup';
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
  magicMcpBackingCleanupManyQueueProcessor,
  magicMcpBackingCleanupBackingsManyQueueProcessor,
  magicMcpBackingCleanupIntegrationInstancesManyQueueProcessor,
  magicMcpBackingCleanupServerQueueProcessor,
  magicMcpBackingCleanupProviderTemplatesManyQueueProcessor,
  magicMcpBackingCleanupProviderTemplateQueueProcessor,
  providerTemplateCreatedQueueProcessor,
  providerTemplateUpdatedQueueProcessor,
  providerTemplateArchivedQueueProcessor
]);
