import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  tenantLogRetentionCleanupCron,
  tenantLogRetentionCleanupQueueProcessor,
  tenantLogRetentionCleanupSearchQueueProcessor,
  tenantLogRetentionStorageCleanupQueueProcessor
} from './cleanup';
import { tenantSessionRetentionDowngradeSyncQueueProcessor } from './downgradeSync';
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
  tenantLogRetentionSyncQueueProcessor,
  tenantSessionRetentionDowngradeSyncQueueProcessor
]);
