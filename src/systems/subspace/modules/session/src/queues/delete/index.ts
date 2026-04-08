import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  sessionArchivedCleanupCron,
  sessionDeleteManyQueueProcessor,
  sessionDeleteQueueProcessor
} from './session';
import {
  sessionTemplateArchivedCleanupCron,
  sessionTemplateDeleteManyQueueProcessor,
  sessionTemplateDeleteQueueProcessor
} from './sessionTemplate';

export let deleteQueues = combineQueueProcessors([
  sessionArchivedCleanupCron,
  sessionDeleteManyQueueProcessor,
  sessionDeleteQueueProcessor,
  sessionTemplateArchivedCleanupCron,
  sessionTemplateDeleteManyQueueProcessor,
  sessionTemplateDeleteQueueProcessor
]);
