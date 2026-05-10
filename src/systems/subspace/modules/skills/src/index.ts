import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { reconcilerQueues } from './queues/reconciler';
import { searchQueues } from './queues/search';

export * from './queues/reconciler/reconcileSkillProviderLink';
export * from './queues/search/skill';
export * from './services';

export let skillsQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  reconcilerQueues
]);
