import { combineQueueProcessors } from '@lowerdeck/queue';
import { archiveIntegrationInstanceQueueProcessor } from './archiveIntegrationInstance';
import {
  integrationInstanceGroupArchiveProvidersManyQueueProcessor,
  integrationInstanceGroupArchivedQueueProcessor,
  integrationInstanceGroupCreatedQueueProcessor,
  integrationInstanceGroupUpdatedQueueProcessor
} from './integrationInstanceGroup';
import { integrationInstanceGroupProviderSetQueueProcessor } from './integrationInstanceGroupProvider';
import {
  integrationArchivedQueueProcessor,
  integrationArchiveInstancesManyQueueProcessor,
  integrationArchiveProvidersManyQueueProcessor,
  integrationCreatedQueueProcessor,
  integrationDeletedQueueProcessor,
  integrationUpdatedQueueProcessor
} from './integration';
import {
  integrationInstanceArchiveGroupSourcesManyQueueProcessor,
  integrationInstanceArchivedQueueProcessor,
  integrationInstanceCreatedQueueProcessor,
  integrationInstanceDeletedQueueProcessor,
  integrationInstanceUpdatedQueueProcessor
} from './integrationInstance';
import {
  integrationInstanceProviderSetQueueProcessor,
  integrationInstanceProviderSyncGroupProvidersManyQueueProcessor
} from './integrationInstanceProvider';
import {
  integrationProviderArchiveGroupProvidersManyQueueProcessor,
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
  integrationInstanceGroupCreatedQueueProcessor,
  integrationInstanceGroupUpdatedQueueProcessor,
  integrationInstanceGroupArchivedQueueProcessor,
  integrationInstanceGroupArchiveProvidersManyQueueProcessor,
  integrationInstanceGroupProviderSetQueueProcessor,
  integrationInstanceCreatedQueueProcessor,
  integrationInstanceUpdatedQueueProcessor,
  integrationInstanceArchivedQueueProcessor,
  integrationInstanceArchiveGroupSourcesManyQueueProcessor,
  integrationInstanceDeletedQueueProcessor,
  integrationInstanceProviderSetQueueProcessor,
  integrationInstanceProviderSyncGroupProvidersManyQueueProcessor,
  integrationProviderCreatedQueueProcessor,
  integrationProviderUpdatedQueueProcessor,
  integrationProviderArchivedQueueProcessor,
  integrationProviderArchiveInstanceProvidersManyQueueProcessor,
  integrationProviderArchiveGroupProvidersManyQueueProcessor
]);
