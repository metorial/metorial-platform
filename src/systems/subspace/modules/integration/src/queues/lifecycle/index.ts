import { combineQueueProcessors } from '@lowerdeck/queue';
import { archiveIntegrationInstanceQueueProcessor } from './archiveIntegrationInstance';
import {
  delegatedIntegrationInstanceArchiveProvidersManyQueueProcessor,
  delegatedIntegrationInstanceArchivedQueueProcessor,
  delegatedIntegrationInstanceCreatedQueueProcessor,
  delegatedIntegrationInstanceUpdatedQueueProcessor
} from './delegatedIntegrationInstance';
import { delegatedIntegrationInstanceProviderSetQueueProcessor } from './delegatedIntegrationInstanceProvider';
import {
  integrationArchivedQueueProcessor,
  integrationArchiveInstancesManyQueueProcessor,
  integrationArchiveProvidersManyQueueProcessor,
  integrationCreatedQueueProcessor,
  integrationDeletedQueueProcessor,
  integrationUpdatedQueueProcessor
} from './integration';
import {
  integrationInstanceArchiveDelegatedSourcesManyQueueProcessor,
  integrationInstanceArchivedQueueProcessor,
  integrationInstanceCreatedQueueProcessor,
  integrationInstanceDeletedQueueProcessor,
  integrationInstanceUpdatedQueueProcessor
} from './integrationInstance';
import {
  integrationInstanceProviderSetQueueProcessor,
  integrationInstanceProviderSyncDelegatedProvidersManyQueueProcessor
} from './integrationInstanceProvider';
import {
  integrationProviderArchiveDelegatedProvidersManyQueueProcessor,
  integrationProviderArchiveInstanceProvidersManyQueueProcessor,
  integrationProviderArchivedQueueProcessor,
  integrationProviderCreatedQueueProcessor,
  integrationProviderUpdatedQueueProcessor
} from './integrationProvider';

export let lifecycleQueues = combineQueueProcessors([
  archiveIntegrationInstanceQueueProcessor,
  integrationCreatedQueueProcessor,
  integrationUpdatedQueueProcessor,
  integrationArchivedQueueProcessor,
  integrationArchiveInstancesManyQueueProcessor,
  integrationArchiveProvidersManyQueueProcessor,
  integrationDeletedQueueProcessor,
  delegatedIntegrationInstanceCreatedQueueProcessor,
  delegatedIntegrationInstanceUpdatedQueueProcessor,
  delegatedIntegrationInstanceArchivedQueueProcessor,
  delegatedIntegrationInstanceArchiveProvidersManyQueueProcessor,
  delegatedIntegrationInstanceProviderSetQueueProcessor,
  integrationInstanceCreatedQueueProcessor,
  integrationInstanceUpdatedQueueProcessor,
  integrationInstanceArchivedQueueProcessor,
  integrationInstanceArchiveDelegatedSourcesManyQueueProcessor,
  integrationInstanceDeletedQueueProcessor,
  integrationInstanceProviderSetQueueProcessor,
  integrationInstanceProviderSyncDelegatedProvidersManyQueueProcessor,
  integrationProviderCreatedQueueProcessor,
  integrationProviderUpdatedQueueProcessor,
  integrationProviderArchivedQueueProcessor,
  integrationProviderArchiveInstanceProvidersManyQueueProcessor,
  integrationProviderArchiveDelegatedProvidersManyQueueProcessor
]);
