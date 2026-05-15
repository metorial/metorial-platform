import { combineQueueProcessors } from '@lowerdeck/queue';
import {
  skillArchivedQueueProcessor,
  skillCreatedQueueProcessor,
  skillUpdatedQueueProcessor
} from './skill';
import {
  skillGroupArchivedQueueProcessor,
  skillGroupCreatedQueueProcessor,
  skillGroupUpdatedQueueProcessor
} from './skillGroup';
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
  skillGroupCreatedQueueProcessor,
  skillGroupUpdatedQueueProcessor,
  skillGroupArchivedQueueProcessor,
  skillItemCreatedQueueProcessor,
  skillItemArchivedQueueProcessor,
  skillTemplateCreatedQueueProcessor,
  skillTemplateUpdatedQueueProcessor,
  skillTemplateArchivedQueueProcessor
]);
