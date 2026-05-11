import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  skillArchivedQueueProcessor,
  skillCreatedQueueProcessor,
  skillUpdatedQueueProcessor
} from './skill';
import { skillItemArchivedQueueProcessor, skillItemCreatedQueueProcessor } from './skillItem';
import {
  skillTemplateArchivedQueueProcessor,
  skillTemplateCreatedQueueProcessor,
  skillTemplateUpdatedQueueProcessor
} from './skillTemplate';

export let lifecycleQueues = combineQueueProcessors([
  skillCreatedQueueProcessor,
  skillUpdatedQueueProcessor,
  skillArchivedQueueProcessor,
  skillItemCreatedQueueProcessor,
  skillItemArchivedQueueProcessor,
  skillTemplateCreatedQueueProcessor,
  skillTemplateUpdatedQueueProcessor,
  skillTemplateArchivedQueueProcessor
]);
