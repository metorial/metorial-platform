import { combineQueueProcessors } from '@mtsrc/queue';
import {
  slatesRetentionCron,
  slatesRetentionStorageCleanupQueueProcessor,
  slatesTenantRetentionCleanupQueueProcessor,
  slatesTenantRetentionSearchQueueProcessor
} from './cleanup';

export let retentionQueues = combineQueueProcessors([
  slatesRetentionCron,
  slatesTenantRetentionSearchQueueProcessor,
  slatesTenantRetentionCleanupQueueProcessor,
  slatesRetentionStorageCleanupQueueProcessor
]);
