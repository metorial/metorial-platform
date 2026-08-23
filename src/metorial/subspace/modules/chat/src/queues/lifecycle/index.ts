import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  chatIntegrationArchiveInstancesManyQueueProcessor,
  chatIntegrationArchiveProvidersManyQueueProcessor,
  chatIntegrationArchivedQueueProcessor,
  chatIntegrationCreatedQueueProcessor,
  chatIntegrationDeletedQueueProcessor,
  chatIntegrationInstanceArchivedQueueProcessor,
  chatIntegrationInstanceCreatedQueueProcessor,
  chatIntegrationInstanceDeletedQueueProcessor,
  chatIntegrationInstanceUpdatedQueueProcessor,
  chatIntegrationUpdatedQueueProcessor
} from './chatIntegration';

export let lifecycleQueues = combineQueueProcessors([
  chatIntegrationCreatedQueueProcessor,
  chatIntegrationUpdatedQueueProcessor,
  chatIntegrationArchivedQueueProcessor,
  chatIntegrationArchiveInstancesManyQueueProcessor,
  chatIntegrationArchiveProvidersManyQueueProcessor,
  chatIntegrationDeletedQueueProcessor,
  chatIntegrationInstanceCreatedQueueProcessor,
  chatIntegrationInstanceUpdatedQueueProcessor,
  chatIntegrationInstanceArchivedQueueProcessor,
  chatIntegrationInstanceDeletedQueueProcessor
]);

export {
  enqueueChatIntegrationArchived,
  enqueueChatIntegrationCreated,
  enqueueChatIntegrationDeleted,
  enqueueChatIntegrationInstanceArchived,
  enqueueChatIntegrationInstanceCreated,
  enqueueChatIntegrationInstanceDeleted,
  enqueueChatIntegrationInstanceUpdated,
  enqueueChatIntegrationUpdated
} from './chatIntegration';
