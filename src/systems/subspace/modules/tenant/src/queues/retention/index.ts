import { combineQueueProcessors } from '@mtsrc/queue';
import {
  tenantLogRetentionCleanupCron,
  tenantLogRetentionCleanupQueueProcessor,
  tenantLogRetentionCleanupSearchQueueProcessor,
  tenantLogRetentionStorageCleanupQueueProcessor
} from './cleanup';
import {
  tenantLogRetentionSyncCron,
  tenantLogRetentionSyncQueueProcessor,
  tenantLogRetentionSyncSearchQueueProcessor
} from './sync';

export let retentionQueues = combineQueueProcessors([
  tenantLogRetentionCleanupCron,
  tenantLogRetentionCleanupSearchQueueProcessor,
  tenantLogRetentionCleanupQueueProcessor,
  tenantLogRetentionStorageCleanupQueueProcessor,
  tenantLogRetentionSyncCron,
  tenantLogRetentionSyncSearchQueueProcessor,
  tenantLogRetentionSyncQueueProcessor
]);
