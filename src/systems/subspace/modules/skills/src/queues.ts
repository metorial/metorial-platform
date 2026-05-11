import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { reconcilerQueues } from './queues/reconciler';
import { searchQueues } from './queues/search';

import './definitions';

export let skillsQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  reconcilerQueues
]);
