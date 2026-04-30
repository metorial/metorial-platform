import { combineQueueProcessors } from '@lowerdeck/queue';
import { archiveIntegrationInstanceQueueProcessor } from './archiveIntegrationInstance';
import {
  integrationArchivedQueueProcessor,
  integrationArchiveInstancesManyQueueProcessor,
  integrationArchiveProvidersManyQueueProcessor,
  integrationCreatedQueueProcessor,
  integrationDeletedQueueProcessor,
  integrationUpdatedQueueProcessor
} from './integration';
import {
  integrationInstanceArchivedQueueProcessor,
  integrationInstanceCreatedQueueProcessor,
  integrationInstanceDeletedQueueProcessor,
  integrationInstanceUpdatedQueueProcessor
} from './integrationInstance';
import { integrationInstanceProviderSetQueueProcessor } from './integrationInstanceProvider';
import {
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
  integrationInstanceCreatedQueueProcessor,
  integrationInstanceUpdatedQueueProcessor,
  integrationInstanceArchivedQueueProcessor,
  integrationInstanceDeletedQueueProcessor,
  integrationInstanceProviderSetQueueProcessor,
  integrationProviderCreatedQueueProcessor,
  integrationProviderUpdatedQueueProcessor,
  integrationProviderArchivedQueueProcessor,
  integrationProviderArchiveInstanceProvidersManyQueueProcessor
]);
