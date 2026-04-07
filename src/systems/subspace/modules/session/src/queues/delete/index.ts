import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  sessionArchivedCleanupCron,
  sessionDeleteManyQueueProcessor,
  sessionDeleteQueueProcessor
} from './session';

export let deleteQueues = combineQueueProcessors([
  sessionArchivedCleanupCron,
  sessionDeleteManyQueueProcessor,
  sessionDeleteQueueProcessor
]);
