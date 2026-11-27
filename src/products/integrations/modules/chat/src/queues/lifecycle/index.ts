import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  chatConnectionArchiveInstancesManyQueueProcessor,
  chatConnectionArchiveProvidersManyQueueProcessor,
  chatConnectionArchivedQueueProcessor,
  chatConnectionCreatedQueueProcessor,
  chatConnectionDeletedQueueProcessor,
  chatInstanceArchivedQueueProcessor,
  chatInstanceCreatedQueueProcessor,
  chatInstanceDeletedQueueProcessor,
  chatInstanceUpdatedQueueProcessor,
  chatConnectionUpdatedQueueProcessor
} from './chatConnection';

export let lifecycleQueues = combineQueueProcessors([
  chatConnectionCreatedQueueProcessor,
  chatConnectionUpdatedQueueProcessor,
  chatConnectionArchivedQueueProcessor,
  chatConnectionArchiveInstancesManyQueueProcessor,
  chatConnectionArchiveProvidersManyQueueProcessor,
  chatConnectionDeletedQueueProcessor,
  chatInstanceCreatedQueueProcessor,
  chatInstanceUpdatedQueueProcessor,
  chatInstanceArchivedQueueProcessor,
  chatInstanceDeletedQueueProcessor
]);

export {
  enqueueChatConnectionArchived,
  enqueueChatConnectionCreated,
  enqueueChatConnectionDeleted,
  enqueueChatInstanceArchived,
  enqueueChatInstanceCreated,
  enqueueChatInstanceDeleted,
  enqueueChatInstanceUpdated,
  enqueueChatConnectionUpdated
} from './chatConnection';

export let lifecycleSubspaceQueues = combineQueueProcessors([
  chatConnectionCreatedQueueProcessor,
  chatConnectionUpdatedQueueProcessor,
  chatInstanceCreatedQueueProcessor,
  chatInstanceUpdatedQueueProcessor
]);

export let lifecycleFederationQueues = combineQueueProcessors([
  chatConnectionArchivedQueueProcessor,
  chatConnectionArchiveInstancesManyQueueProcessor,
  chatConnectionArchiveProvidersManyQueueProcessor,
  chatConnectionDeletedQueueProcessor,
  chatInstanceArchivedQueueProcessor,
  chatInstanceDeletedQueueProcessor
]);
