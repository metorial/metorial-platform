import { combineQueueProcessors } from '@metorial/queue';
import { propagateSkillDirtyQueueProcessor, skillLifecycleQueueProcessor } from './skill';
import {
  propagateSkillConfigurationDirtyQueueProcessor,
  skillConfigurationLifecycleQueueProcessor
} from './skillConfiguration';
import { skillGroupLifecycleQueueProcessor } from './skillGroup';
import { skillTemplateLifecycleQueueProcessor } from './skillTemplate';

export * from './skill';
export * from './skillConfiguration';
export * from './skillGroup';
export * from './skillTemplate';

export let lifecycleQueues = combineQueueProcessors([
  skillLifecycleQueueProcessor,
  skillGroupLifecycleQueueProcessor,
  skillTemplateLifecycleQueueProcessor,
  skillConfigurationLifecycleQueueProcessor,
  propagateSkillDirtyQueueProcessor,
  propagateSkillConfigurationDirtyQueueProcessor
]);
