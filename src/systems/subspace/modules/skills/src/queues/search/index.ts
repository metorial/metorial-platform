import { combineQueueProcessors } from '@mtsrc/queue';
import { indexSkillGroupQueueProcessor } from './skillGroup';
import { indexSkillQueueProcessor } from './skill';
import { indexSkillTemplateQueueProcessor } from './skillTemplate';

export let searchQueues = combineQueueProcessors([
  indexSkillQueueProcessor,
  indexSkillGroupQueueProcessor,
  indexSkillTemplateQueueProcessor
]);
