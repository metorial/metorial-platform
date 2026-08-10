import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { reconcilerQueues } from './queues/reconciler';

export let skillsQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  reconcilerQueues
]);
