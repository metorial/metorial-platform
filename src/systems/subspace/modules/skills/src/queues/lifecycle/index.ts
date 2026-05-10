import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  skillArchivedQueueProcessor,
  skillCreatedQueueProcessor,
  skillUpdatedQueueProcessor
} from './skill';
import { skillItemArchivedQueueProcessor, skillItemCreatedQueueProcessor } from './skillItem';

export let lifecycleQueues = combineQueueProcessors([
  skillCreatedQueueProcessor,
  skillUpdatedQueueProcessor,
  skillArchivedQueueProcessor,
  skillItemCreatedQueueProcessor,
  skillItemArchivedQueueProcessor
]);
