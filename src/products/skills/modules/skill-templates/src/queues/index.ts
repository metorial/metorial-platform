import { combineQueueProcessors } from '@metorial/queue';
import { skillTemplateLifecycleQueueProcessor } from './lifecycle';
import { indexSkillTemplateQueueProcessor } from './search';

export { indexSkillTemplateQueue } from './search';

export let skillTemplateQueueProcessor = combineQueueProcessors([
  skillTemplateLifecycleQueueProcessor,
  indexSkillTemplateQueueProcessor
]);
