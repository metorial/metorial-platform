import { combineQueueProcessors } from '@lowerdeck/queue';
import { commitQueues } from './queues/commit';
import { deploymentQueues } from './queues/deployment';
import { lifecycleQueues } from './queues/lifecycle';
import { searchQueues } from './queues/search';
import { upcomingQueues } from './queues/upcoming';

export { syncVersionToCustomProvider } from './internal/createVersion';
export * from './presenters';
export * from './services';

export let customProviderQueueProcessor = combineQueueProcessors([
  lifecycleQueues,
  searchQueues,
  deploymentQueues,
  commitQueues,
  upcomingQueues
]);
