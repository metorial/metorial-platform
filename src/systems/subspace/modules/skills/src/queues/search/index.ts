import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexSkillQueueProcessor } from './skill';
import { indexSkillTemplateQueueProcessor } from './skillTemplate';

export let searchQueues = combineQueueProcessors([
  indexSkillQueueProcessor,
  indexSkillTemplateQueueProcessor
]);
