import { combineQueueProcessors } from '@lowerdeck/queue';
import { indexSkillQueueProcessor } from './skill';

export let searchQueues = combineQueueProcessors([indexSkillQueueProcessor]);
