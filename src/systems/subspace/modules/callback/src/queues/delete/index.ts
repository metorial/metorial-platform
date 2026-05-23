import { combineQueueProcessors } from '@mtsrc/queue';
import {
  callbackArchivedCleanupCron,
  callbackDeleteManyQueueProcessor,
  callbackDeleteQueueProcessor
} from './callback';

export let deleteQueues = combineQueueProcessors([
  callbackArchivedCleanupCron,
  callbackDeleteManyQueueProcessor,
  callbackDeleteQueueProcessor
]);
