import { combineQueueProcessors } from '@lowerdeck/queue';
import { lifecycleQueues } from './queues/lifecycle';
import { mirrorQueues } from './queues/mirror';
import { searchQueues } from './queues/search';

export let agentQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  mirrorQueues,
  searchQueues
]);
