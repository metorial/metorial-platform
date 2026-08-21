import { combineQueueProcessors } from '@lowerdeck/queue';
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

export let deleteQueues = combineQueueProcessors([
  chatIntegrationArchivedCleanupCron,
  chatIntegrationDeleteManyQueueProcessor,
  chatIntegrationDeleteQueueProcessor,
  chatIntegrationInstanceArchivedCleanupCron,
  chatIntegrationInstanceDeleteManyQueueProcessor,
  chatIntegrationInstanceDeleteQueueProcessor
]);
