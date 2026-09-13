import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  chatArchivedCleanupCron,
  chatDeleteManyQueueProcessor,
  chatDeleteQueueProcessor
} from './chat';
import {
  chatIntegrationArchivedCleanupCron,
  chatIntegrationDeleteManyQueueProcessor,
  chatIntegrationDeleteQueueProcessor
} from './chatIntegration';
import {
  chatIntegrationInstanceArchivedCleanupCron,
  chatIntegrationInstanceDeleteManyQueueProcessor,
  chatIntegrationInstanceDeleteQueueProcessor
} from './chatIntegrationInstance';
import {
  chatMessageDeletedCleanupCron,
  chatMessageDeleteManyQueueProcessor,
  chatMessageDeleteQueueProcessor
} from './chatMessage';

export let deleteQueues = combineQueueProcessors([
  chatArchivedCleanupCron,
  chatDeleteManyQueueProcessor,
  chatDeleteQueueProcessor,
  chatIntegrationArchivedCleanupCron,
  chatIntegrationDeleteManyQueueProcessor,
  chatIntegrationDeleteQueueProcessor,
  chatIntegrationInstanceArchivedCleanupCron,
  chatIntegrationInstanceDeleteManyQueueProcessor,
  chatIntegrationInstanceDeleteQueueProcessor,
  chatMessageDeletedCleanupCron,
  chatMessageDeleteManyQueueProcessor,
  chatMessageDeleteQueueProcessor
]);
