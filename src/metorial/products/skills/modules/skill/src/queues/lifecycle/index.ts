import { combineQueueProcessors } from '@metorial/queue';
import { propagateSkillDirtyQueueProcessor, skillLifecycleQueueProcessor } from './skill';

export * from './skill';

export let lifecycleQueues = combineQueueProcessors([
  skillLifecycleQueueProcessor,
  propagateSkillDirtyQueueProcessor
]);
