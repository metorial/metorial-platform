import { combineQueueProcessors } from '@mtsrc/queue';
import {
  integrationArchivedCleanupCron,
  integrationDeleteManyQueueProcessor,
  integrationDeleteQueueProcessor
} from './integration';
import {
  integrationInstanceArchivedCleanupCron,
  integrationInstanceDeleteManyQueueProcessor,
  integrationInstanceDeleteQueueProcessor
} from './integrationInstance';

export let deleteQueues = combineQueueProcessors([
  integrationArchivedCleanupCron,
  integrationDeleteManyQueueProcessor,
  integrationDeleteQueueProcessor,
  integrationInstanceArchivedCleanupCron,
  integrationInstanceDeleteManyQueueProcessor,
  integrationInstanceDeleteQueueProcessor
]);
