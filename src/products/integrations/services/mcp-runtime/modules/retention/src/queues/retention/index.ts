import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  shuttleRetentionProcessors,
  shuttleRetentionStorageCleanupQueueProcessor
} from './cleanup';

export let retentionQueues = combineQueueProcessors([
  shuttleRetentionProcessors,
  shuttleRetentionStorageCleanupQueueProcessor
]);
