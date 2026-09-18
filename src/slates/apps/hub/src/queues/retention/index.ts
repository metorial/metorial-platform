import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  slatesRetentionProcessors,
  slatesRetentionStorageCleanupQueueProcessor
} from './cleanup';

export let retentionQueues = combineQueueProcessors([
  slatesRetentionProcessors,
  slatesRetentionStorageCleanupQueueProcessor
]);
