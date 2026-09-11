import { combineQueueProcessors } from '@lowerdeck/queue';
import { commitQueues } from './queues/commit';
import { deploymentQueues } from './queues/deployment';
import { lifecycleQueues } from './queues/lifecycle';
import { scmQueues } from './queues/scm';
import { searchQueues } from './queues/search';
import { upcomingQueues } from './queues/upcoming';

export let customProviderQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  scmQueues,
  deploymentQueues,
  commitQueues,
  upcomingQueues
]);
