import { combineQueueProcessors } from '@metorial/queue';
import {
  propagateSkillConfigurationDirtyQueueProcessor,
  skillConfigurationLifecycleQueueProcessor
} from './lifecycle';

export let skillConfigurationQueueProcessor = combineQueueProcessors([
  skillConfigurationLifecycleQueueProcessor,
  propagateSkillConfigurationDirtyQueueProcessor
]);
