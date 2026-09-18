import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  tenantLogRetentionProcessors,
  tenantLogRetentionStorageCleanupQueueProcessor
} from './cleanup';
import { tenantSessionRetentionDowngradeSyncQueueProcessor } from './downgradeSync';
import {
  tenantLogRetentionSyncCron,
  tenantLogRetentionSyncQueueProcessor,
  tenantLogRetentionSyncSearchQueueProcessor
} from './sync';

export let retentionQueues = combineQueueProcessors([
  tenantLogRetentionProcessors,
  tenantLogRetentionStorageCleanupQueueProcessor,
  tenantLogRetentionSyncCron,
  tenantLogRetentionSyncSearchQueueProcessor,
  tenantLogRetentionSyncQueueProcessor,
  tenantSessionRetentionDowngradeSyncQueueProcessor
]);
