import { combineQueueProcessors } from '@metorial/queue';
import { skillGroupLifecycleQueueProcessor } from './lifecycle';
import { indexSkillGroupQueueProcessor } from './search';

export { indexSkillGroupQueue } from './search';

export let skillGroupQueueProcessor = combineQueueProcessors([
  skillGroupLifecycleQueueProcessor,
  indexSkillGroupQueueProcessor
]);
