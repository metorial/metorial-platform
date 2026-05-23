import { combineQueueProcessors } from '@mtsrc/queue';
import {
  sessionDeleteManyQueueProcessor,
  sessionDeleteQueueProcessor,
  sessionRetentionCleanupCron,
  sessionRetentionTenantQueueProcessor,
  sessionRetentionTenantSearchQueueProcessor
} from './session';
import {
  sessionTemplateArchivedCleanupCron,
  sessionTemplateDeleteManyQueueProcessor,
  sessionTemplateDeleteQueueProcessor
} from './sessionTemplate';

export let deleteQueues = combineQueueProcessors([
  sessionRetentionCleanupCron,
  sessionRetentionTenantSearchQueueProcessor,
  sessionRetentionTenantQueueProcessor,
  sessionDeleteManyQueueProcessor,
  sessionDeleteQueueProcessor,
  sessionTemplateArchivedCleanupCron,
  sessionTemplateDeleteManyQueueProcessor,
  sessionTemplateDeleteQueueProcessor
]);
