import { combineQueueProcessors } from '@metorial/queue';
import { reindexSkillResourcesQueueProcessor } from './reindex';
import { indexSkillQueueProcessor } from './skill';

export * from './reindex';
export * from './skill';

export let searchQueues = combineQueueProcessors([
  indexSkillQueueProcessor,
  reindexSkillResourcesQueueProcessor
]);
