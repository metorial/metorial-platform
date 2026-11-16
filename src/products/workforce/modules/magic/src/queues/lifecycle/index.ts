import { combineQueueProcessors } from '@metorial/queue';
import {
  magicMcpEndpointCreatedQueueProcessor,
  magicMcpEndpointDeletedQueueProcessor,
  magicMcpEndpointUpdatedQueueProcessor
} from './magicMcpEndpoint';
import {
  magicMcpEndpointServerAccessRevokedManyQueueProcessor,
  magicMcpEndpointServerAccessRevokedSingleQueueProcessor
} from './magicMcpEndpointServerAccess';
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
import { consumerProfileDeletedMagicMcpTokensQueueProcessor } from './magicMcpToken';
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
export * from './magicMcpEndpointServerAccess';
export * from './magicMcpGroup';
export * from './magicMcpServer';
export * from './magicMcpToken';
export * from './magicMcpBackingCleanup';
export * from './providerTemplate';

export let magicLifecycleQueueProcessor = combineQueueProcessors([
  magicMcpEndpointCreatedQueueProcessor,
  magicMcpEndpointUpdatedQueueProcessor,
  magicMcpEndpointDeletedQueueProcessor,
  magicMcpEndpointServerAccessRevokedManyQueueProcessor,
  magicMcpEndpointServerAccessRevokedSingleQueueProcessor,
  magicMcpGroupCreatedQueueProcessor,
  magicMcpGroupUpdatedQueueProcessor,
  magicMcpGroupDeletedQueueProcessor,
  magicMcpServerCreatedQueueProcessor,
  magicMcpServerUpdatedQueueProcessor,
  magicMcpServerDeletedQueueProcessor,
  consumerProfileDeletedMagicMcpTokensQueueProcessor,
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
