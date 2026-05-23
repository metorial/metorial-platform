import { combineQueueProcessors } from '@mtsrc/queue';
import {
  shuttleRetentionCron,
  shuttleRetentionStorageCleanupQueueProcessor,
  shuttleTenantRetentionCleanupQueueProcessor,
  shuttleTenantRetentionSearchQueueProcessor
} from './cleanup';

export let retentionQueues = combineQueueProcessors([
  shuttleRetentionCron,
  shuttleTenantRetentionSearchQueueProcessor,
  shuttleTenantRetentionCleanupQueueProcessor,
  shuttleRetentionStorageCleanupQueueProcessor
]);
