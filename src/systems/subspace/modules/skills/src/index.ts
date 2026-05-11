import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { reconcilerQueues } from './queues/reconciler';
import { searchQueues } from './queues/search';

export * from './services';

import './definitions';

export let skillsQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  reconcilerQueues
]);
