import { combineQueueProcessors } from '@lowerdeck/queue';
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
